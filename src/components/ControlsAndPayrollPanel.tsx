import { CheckSquare, Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { NAFIS_CONTROLS, NAFIS_PRESETS } from '../core/index.ts';
import type {
  AssessmentInput,
  AssessmentResult,
  ControlEvaluationItem,
  NafisControlId,
} from '../core/types.ts';
import { downloadSafeBomCsv } from '../lib/api.ts';
import { UI_LABELS, formatAed, isolateLtr, type UiLang } from '../lib/i18n.ts';

interface Props {
  lang: UiLang;
  input: AssessmentInput;
  result: AssessmentResult;
  controls: ControlEvaluationItem[];
  locked: boolean;
  onChange: (next: AssessmentInput) => void;
}

export function ControlsAndPayrollPanel({
  lang,
  input,
  result,
  controls,
  locked,
  onChange,
}: Props) {
  const t = UI_LABELS[lang];
  const isAr = lang === 'ar';

  const toggleControl = (id: NafisControlId) => {
    if (locked) return;
    const current = new Set(input.implementedControls);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    onChange({
      ...input,
      implementedControls: Array.from(current),
    });
  };

  const handleFileUpload = (file: File | undefined) => {
    if (!file || locked) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...input, payrollCsv: String(reader.result || '') });
    };
    reader.readAsText(file, 'utf-8');
  };

  const audit = result.payrollAudit;

  return (
    <section className="naf-card rounded-2xl p-5 space-y-6">
      {/* Operational Controls */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <CheckSquare className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <span>{t.controlsTitle}</span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t.controlsSub}
          </p>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {t.controlsChecklist}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          {controls.map((item) => {
            const spec = NAFIS_CONTROLS.find((c) => c.id === item.id);
            return (
              <label
                key={item.id}
                className="flex items-start gap-2.5 rounded-xl p-3 border cursor-pointer transition"
                style={{
                  backgroundColor: item.implemented ? 'var(--bg-soft)' : 'var(--bg-elevated)',
                  borderColor: item.implemented ? 'var(--accent-primary)' : 'var(--border-subtle)',
                }}
              >
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={item.implemented}
                  onChange={() => toggleControl(item.id)}
                  className="mt-0.5 shrink-0 accent-teal-700"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className="naf-mono text-[11px] font-bold px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        color: item.implemented ? 'var(--accent-primary)' : 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {isolateLtr(item.id)}
                    </span>
                    <span
                      className="naf-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {isolateLtr(`${item.weight} pts`)}
                    </span>
                  </div>
                  <div className="font-bold">{isAr ? item.titleAr : item.titleEn}</div>
                  {spec && (
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {isAr ? spec.descriptionAr : spec.descriptionEn}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Payroll CSV Auditor */}
      <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
              <span>{t.payrollTitle}</span>
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {t.payrollSub}
            </p>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                onChange({ ...input, payrollCsv: NAFIS_PRESETS[2]!.input.payrollCsv || '' })
              }
              className="px-3 py-1.5 rounded-lg border font-semibold cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              {t.loadSampleCsv}
            </button>

            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold cursor-pointer"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t.uploadCsv}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={locked}
                className="sr-only"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
            </label>

            {input.payrollCsv && (
              <button
                type="button"
                disabled={locked}
                onClick={() => onChange({ ...input, payrollCsv: '' })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer disabled:opacity-50"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.clearCsv}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => downloadSafeBomCsv(input, result, `${input.establishmentName}-audit`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.exportSafeCsv}</span>
            </button>
          </div>
        </div>

        <textarea
          rows={5}
          dir="ltr"
          disabled={locked}
          className="naf-input naf-mono text-xs"
          placeholder="employee_id,full_name,nationality,role_tier,monthly_salary_aed,hire_date,registered_in_wps,registered_in_pension"
          value={input.payrollCsv ?? ''}
          onChange={(e) => onChange({ ...input, payrollCsv: e.target.value })}
        />

        {audit && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full font-bold" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                {isAr ? `إجمالي المواطنين: ${audit.emiratiRows}` : `Emirati Rows: ${audit.emiratiRows}`}
              </span>
              <span
                className="px-2.5 py-1 rounded-full font-bold"
                style={{ backgroundColor: 'var(--accent-teal-soft)', color: 'var(--accent-teal)' }}
              >
                {isAr ? `مؤهل للاحتساب: ${audit.eligibleEmiratiCount}` : `Eligible: ${audit.eligibleEmiratiCount}`}
              </span>
              {audit.excludedSub6kCount > 0 && (
                <span
                  className="px-2.5 py-1 rounded-full font-bold"
                  style={{ backgroundColor: 'var(--accent-crimson-soft)', color: 'var(--accent-crimson)' }}
                >
                  {isAr ? `مستبعد (< 6,000 د.إ): ${audit.excludedSub6kCount}` : `Excluded (<6k AED): ${audit.excludedSub6kCount}`}
                </span>
              )}
              {audit.missingWpsCount > 0 && (
                <span
                  className="px-2.5 py-1 rounded-full font-bold"
                  style={{ backgroundColor: 'var(--accent-crimson-soft)', color: 'var(--accent-crimson)' }}
                >
                  {isAr ? `ناقص WPS: ${audit.missingWpsCount}` : `No WPS: ${audit.missingWpsCount}`}
                </span>
              )}
              {audit.missingPensionCount > 0 && (
                <span
                  className="px-2.5 py-1 rounded-full font-bold"
                  style={{ backgroundColor: 'var(--accent-crimson-soft)', color: 'var(--accent-crimson)' }}
                >
                  {isAr ? `ناقص تقاعد: ${audit.missingPensionCount}` : `No Pension: ${audit.missingPensionCount}`}
                </span>
              )}
            </div>

            {audit.rows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
                <table className="w-full text-xs text-start">
                  <thead style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                    <tr>
                      <th className="p-2 font-semibold">{isAr ? 'المعرف' : 'ID'}</th>
                      <th className="p-2 font-semibold">{isAr ? 'الاسم' : 'Employee'}</th>
                      <th className="p-2 font-semibold">{isAr ? 'الراتب' : 'Salary'}</th>
                      <th className="p-2 font-semibold">WPS</th>
                      <th className="p-2 font-semibold">{isAr ? 'التقاعد' : 'Pension'}</th>
                      <th className="p-2 font-semibold">{isAr ? 'يُحتسب؟' : 'Counts?'}</th>
                      <th className="p-2 font-semibold">{isAr ? 'الملاحظات' : 'Audit Notes'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.rows.map((r) => (
                      <tr key={`${r.rowNumber}-${r.employeeId}`} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="p-2 naf-mono">{isolateLtr(r.employeeId)}</td>
                        <td className="p-2 font-medium">{r.fullName}</td>
                        <td className="p-2 naf-mono num-tabular">{formatAed(r.monthlySalaryAed)}</td>
                        <td className="p-2">{r.registeredInWps ? '✓' : '✗'}</td>
                        <td className="p-2">{r.registeredInPension ? '✓' : '✗'}</td>
                        <td className="p-2">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              backgroundColor: r.countsTowardQuota
                                ? 'var(--accent-teal-soft)'
                                : 'var(--accent-crimson-soft)',
                              color: r.countsTowardQuota ? 'var(--accent-teal)' : 'var(--accent-crimson)',
                            }}
                          >
                            {r.countsTowardQuota
                              ? isAr
                                ? 'مؤهل'
                                : 'ELIGIBLE'
                              : isAr
                                ? 'مستبعد'
                                : 'EXCLUDED'}
                          </span>
                        </td>
                        <td className="p-2" style={{ color: 'var(--text-secondary)' }}>
                          {r.reasons.length > 0 ? r.reasons.join(' · ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
