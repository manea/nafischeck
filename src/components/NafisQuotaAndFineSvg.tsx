import type { AssessmentResult } from '../core/types.ts';
import { TIER_LABELS, UI_LABELS, formatAed, isolateLtr, type UiLang } from '../lib/i18n.ts';

interface Props {
  lang: UiLang;
  result: AssessmentResult;
}

export function NafisQuotaAndFineSvg({ lang, result }: Props) {
  const t = UI_LABELS[lang];
  const isAr = lang === 'ar';
  const q = result.quota;

  const trackW = 536;
  const quotaMax = Math.max(q.requiredEmiratis, q.activeEligibleEmiratis, 2);
  const activeW =
    q.activeEligibleEmiratis > 0
      ? Math.max(18, Math.round((q.activeEligibleEmiratis / quotaMax) * trackW))
      : 0;
  const requiredMarkerX =
    q.requiredEmiratis > 0
      ? 12 + Math.min(trackW, Math.max(12, Math.round((q.requiredEmiratis / quotaMax) * trackW)))
      : 12;

  const annualRisk = q.annualPenaltyAed > 0 ? q.annualPenaltyAed : q.potentialAnnualPenaltyAed;
  const riskCeiling = Math.max(annualRisk, 120000);
  const riskW = annualRisk > 0 ? Math.max(14, Math.round((annualRisk / riskCeiling) * trackW)) : 0;

  return (
    <section className="naf-card rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">{t.chartTitle}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t.chartSub}
          </p>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
        >
          {TIER_LABELS[q.tier][lang]}
        </span>
      </div>

      {/* Forced LTR SVG track so Arabic RTL layout never reverses horizontal gauge geometry */}
      <div
        className="rounded-xl border p-3.5 overflow-x-auto"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div dir="ltr">
          <svg
            style={{ direction: 'ltr' }}
            viewBox="0 0 560 154"
            className="w-full h-auto max-h-52"
            role="img"
            aria-label={
              isAr
                ? 'مخطط مقارنة نصاب التوطين والغرامة السنوية المحتملة'
                : 'NafisCheck Emiratisation Quota and Annual Penalty Chart'
            }
          >
            {/* Track 1: Emirati Headcount vs Required */}
            <text x="12" y="18" fill="var(--text-primary)" fontSize="12" fontWeight="700">
              {isAr
                ? `نصاب المواطنين المؤهلين (${q.activeEligibleEmiratis} من ${q.requiredEmiratis} مطلوبين)`
                : `Eligible Emirati Headcount (${q.activeEligibleEmiratis} / ${q.requiredEmiratis} required)`}
            </text>
            <text
              x="548"
              y="18"
              textAnchor="end"
              fill={q.shortfallSlots === 0 ? 'var(--accent-teal)' : q.graceBackfillActive ? 'var(--accent-amber)' : 'var(--accent-crimson)'}
              fontSize="11"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {q.tier === 'large_50_plus'
                ? `${q.targetRatePct}% SKILLED QUOTA`
                : q.tier === 'medium_20_49_designated'
                  ? '20-49 14-SECTOR RULE'
                  : 'EXEMPT SCOPE'}
            </text>

            <rect x="12" y="28" width={trackW} height="22" rx="6" fill="var(--border-subtle)" fillOpacity="0.45" />
            {activeW > 0 && (
              <rect
                x="12"
                y="28"
                width={activeW}
                height="22"
                rx="6"
                fill={
                  q.shortfallSlots === 0
                    ? 'var(--accent-teal)'
                    : q.graceBackfillActive
                      ? 'var(--accent-amber)'
                      : 'var(--accent-crimson)'
                }
              />
            )}
            {q.requiredEmiratis > 0 && (
              <>
                <line
                  x1={requiredMarkerX}
                  y1="24"
                  x2={requiredMarkerX}
                  y2="54"
                  stroke="var(--text-primary)"
                  strokeWidth="2.5"
                  strokeDasharray="3 2"
                />
                <text
                  x={Math.min(540, Math.max(24, requiredMarkerX))}
                  y="66"
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {`Target: ${q.requiredEmiratis}`}
                </text>
              </>
            )}
            <text x="12" y="66" fill="var(--text-secondary)" fontSize="10" fontFamily="JetBrains Mono, monospace">
              {`Active: ${q.activeEligibleEmiratis} | Shortfall: ${q.shortfallSlots}`}
            </text>

            {/* Track 2: Annual MoHRE Shortfall Penalty */}
            <text x="12" y="96" fill="var(--text-primary)" fontSize="12" fontWeight="700">
              {isAr ? 'التعرض السنوي لغرامة نقص التوطين (MoHRE AED)' : 'Annual MoHRE Non-Compliance Exposure (AED)'}
            </text>
            <text
              x="548"
              y="96"
              textAnchor="end"
              fill={q.annualPenaltyAed > 0 ? 'var(--accent-crimson)' : q.graceBackfillActive ? 'var(--accent-amber)' : 'var(--accent-teal)'}
              fontSize="11"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {q.annualPenaltyAed > 0
                ? `ACTIVE FINE: AED ${q.annualPenaltyAed.toLocaleString('en-US')}/YR`
                : q.graceBackfillActive
                  ? `GRACE SHIELD (${q.backfillDaysRemaining ?? 0}D LEFT)`
                  : 'AED 0 FINE'}
            </text>

            <rect x="12" y="106" width={trackW} height="18" rx="8" fill="var(--border-subtle)" fillOpacity="0.45" />
            {riskW > 0 && (
              <rect
                x="12"
                y="106"
                width={riskW}
                height="18"
                rx="8"
                fill={q.annualPenaltyAed > 0 ? 'var(--accent-crimson)' : 'var(--accent-amber)'}
              />
            )}
            <text x="12" y="141" fill="var(--text-secondary)" fontSize="11" fontFamily="JetBrains Mono, monospace">
              {`Monthly Fine: AED ${q.monthlyPenaltyAed.toLocaleString('en-US')}/mo`}
            </text>
            <text
              x="548"
              y="141"
              textAnchor="end"
              fill={annualRisk > 0 ? 'var(--accent-crimson)' : 'var(--accent-teal)'}
              fontSize="11"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {`Potential Exposure: AED ${q.potentialAnnualPenaltyAed.toLocaleString('en-US')}/yr`}
            </text>
          </svg>
        </div>

        <div
          className="mt-2 pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <span>
            {isAr
              ? `المطلوب: ${q.requiredEmiratis} · المؤهل: ${q.activeEligibleEmiratis} · العجز: ${q.shortfallSlots}`
              : `Required: ${q.requiredEmiratis} · Eligible: ${q.activeEligibleEmiratis} · Shortfall: ${q.shortfallSlots}`}
          </span>
          <span
            className="naf-mono font-bold"
            style={{
              color:
                q.annualPenaltyAed > 0
                  ? 'var(--accent-crimson)'
                  : q.graceBackfillActive
                    ? 'var(--accent-amber)'
                    : 'var(--accent-teal)',
            }}
          >
            {isAr
              ? `الغرامة السنوية: ${formatAed(q.annualPenaltyAed)} / سنوياً`
              : `Annual Penalty: ${formatAed(q.annualPenaltyAed)} / yr`}
          </span>
        </div>
      </div>

      {/* Three Key Statutory Gate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div
          className="rounded-xl p-3 border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>
            {q.tier === 'large_50_plus'
              ? isAr
                ? `مستهدف 50+ نهاية ${isolateLtr('2026-12-31')}`
                : `End-2026 Skilled Target (${isolateLtr('2026-12-31')})`
              : q.tier === 'medium_20_49_designated'
                ? isAr
                  ? 'مستهدف القطاعات الـ 14 (20–49)'
                  : '20–49 Designated 14-Sector Rule'
                : isAr
                  ? 'النطاق التنظيمي الاتحادي'
                  : 'Federal Quota Scope'}
          </div>
          <div className="naf-mono font-bold mt-1" style={{ color: 'var(--accent-primary)' }}>
            {q.tier === 'large_50_plus'
              ? isolateLtr(`${q.targetRatePct}% (${q.requiredEmiratis} slots)`)
              : q.tier === 'medium_20_49_designated'
                ? isolateLtr(`${q.requiredEmiratis} citizens (14 sectors)`)
                : isAr
                  ? 'خارج نطاق النصاب'
                  : 'Exempt Scope'}
          </div>
        </div>

        <div
          className="rounded-xl p-3 border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>
            {isAr
              ? `بوابة أجر المواطن (${isolateLtr('AED 6,000')})`
              : `Emirati Wage Floor (${isolateLtr('AED 6,000')})`}
          </div>
          <div
            className="font-bold mt-1"
            style={{
              color:
                (result.payrollAudit?.excludedSub6kCount ?? 0) > 0
                  ? 'var(--accent-crimson)'
                  : 'var(--accent-teal)',
            }}
          >
            {result.payrollAudit
              ? isAr
                ? `مؤهل: ${result.payrollAudit.eligibleEmiratiCount} | مستبعد (<6k): ${result.payrollAudit.excludedSub6kCount}`
                : `Eligible: ${result.payrollAudit.eligibleEmiratiCount} | Excluded (<6k): ${result.payrollAudit.excludedSub6kCount}`
              : isAr
                ? 'وضع العدد اليدوي (بدون CSV)'
                : 'Manual Count Mode (No CSV)'}
          </div>
        </div>

        <div
          className="rounded-xl p-3 border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'حالة مهلة الاستبدال (60 يوماً)' : '60-Day Replacement Grace Status'}
          </div>
          <div
            className="naf-mono font-bold mt-1"
            style={{
              color: q.graceBackfillActive
                ? 'var(--accent-amber)'
                : q.annualPenaltyAed > 0
                  ? 'var(--accent-crimson)'
                  : 'var(--accent-teal)',
            }}
          >
            {q.graceBackfillActive
              ? isAr
                ? `مهلة نشطة (متبقٍ ${q.backfillDaysRemaining ?? 0} يوم)`
                : `ACTIVE (${q.backfillDaysRemaining ?? 0}d left)`
              : q.annualPenaltyAed > 0
                ? isAr
                  ? `مستحقة (${formatAed(q.monthlyPenaltyAed)}/شهر)`
                  : `EXPOSED (${formatAed(q.monthlyPenaltyAed)}/mo)`
                : isAr
                  ? 'مستوفى بدون غرامة'
                  : 'No Active Shortfall'}
          </div>
        </div>
      </div>
    </section>
  );
}
