import {
  AlertTriangle,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Printer,
  Save,
  Trash2,
} from 'lucide-react';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import type { StoredDossier } from '../lib/api.ts';
import { withBase } from '../lib/basePath.ts';
import { STATUS_META, UI_LABELS, formatAed, isolateLtr, type UiLang } from '../lib/i18n.ts';

interface Props {
  lang: UiLang;
  input: AssessmentInput;
  result: AssessmentResult;
  activeDossier: StoredDossier | null;
  savedDossiers: StoredDossier[];
  busy: boolean;
  onChange: (next: AssessmentInput) => void;
  onSaveDraft: () => void;
  onSealDossier: () => void;
  onDuplicateDraft: () => void;
  onDeleteDraft: () => void;
  onSelectDossier: (d: StoredDossier) => void;
  onDownloadMd: () => void;
  onDownloadCsv: () => void;
  onOpenPublicRoute: (slugOrCode: string) => void;
}

export function DossierPreviewAndPrint({
  lang,
  input,
  result,
  activeDossier,
  savedDossiers,
  busy,
  onChange,
  onSaveDraft,
  onSealDossier,
  onDuplicateDraft,
  onDeleteDraft,
  onSelectDossier,
  onDownloadMd,
  onDownloadCsv,
  onOpenPublicRoute,
}: Props) {
  const t = UI_LABELS[lang];
  const isAr = lang === 'ar';
  const locked = activeDossier?.status === 'locked';
  const statusMeta = STATUS_META[result.status];
  const shareTarget = activeDossier ? activeDossier.dossierCode || activeDossier.slug : '';

  return (
    <section className="naf-card print-only-sheet rounded-2xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold flex flex-wrap items-center gap-2">
            <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <span>{t.dossierTitle}</span>
            <span className="naf-mono text-sm whitespace-nowrap inline-block">
              {`(${isolateLtr('NAF-YYYY-0001')})`}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
            <span
              className="px-2.5 py-0.5 rounded-full font-bold"
              style={{ backgroundColor: statusMeta.bgVar, color: statusMeta.textVar }}
            >
              {statusMeta[lang]}
            </span>
            <span className="naf-mono num-tabular font-bold">
              {isAr
                ? `الدرجة: ${isolateLtr(`${result.readinessScore}/100`)}`
                : `Score: ${result.readinessScore}/100`}
            </span>
            {activeDossier?.dossierCode && (
              <span
                className="naf-mono px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1"
                style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
              >
                <Lock className="w-3 h-3" />
                <span>{isolateLtr(activeDossier.dossierCode)}</span>
              </span>
            )}
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2 text-xs">
          {!locked ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onSaveDraft}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t.saveDraft}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={onSealDossier}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t.sealDossier}</span>
              </button>

              {activeDossier && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDeleteDraft}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer disabled:opacity-50"
                  style={{
                    borderColor: 'var(--accent-crimson)',
                    color: 'var(--accent-crimson)',
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.deleteDraft}</span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onDuplicateDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{t.duplicateDraft}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Non-MoHRE / Non-Legal Disclaimer */}
      <div
        className="rounded-xl p-3 border flex items-start gap-2.5 text-xs"
        style={{ backgroundColor: 'var(--accent-amber-soft)', borderColor: 'var(--accent-amber)' }}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--accent-amber)' }} />
        <div>
          <span className="font-bold">{t.disclaimerLabel}: </span>
          <span>{isAr ? result.legalDisclaimerAr : result.legalDisclaimerEn}</span>
        </div>
      </div>

      {/* Print Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div
          className="rounded-xl p-3 border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>{t.establishmentName}</div>
          <div className="font-bold mt-1">{result.establishmentName}</div>
        </div>
        <div
          className="rounded-xl p-3 border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'المطلوب / المؤهل' : 'Required / Eligible'}
          </div>
          <div className="naf-mono font-bold mt-1">
            {isolateLtr(`${result.quota.requiredEmiratis} / ${result.quota.activeEligibleEmiratis}`)}
          </div>
        </div>
        <div
          className="rounded-xl p-3 border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'الغرامة السنوية المقدرة' : 'Estimated Annual Penalty'}
          </div>
          <div
            className="naf-mono font-bold mt-1"
            style={{
              color:
                result.quota.annualPenaltyAed > 0
                  ? 'var(--accent-crimson)'
                  : 'var(--accent-teal)',
            }}
          >
            {formatAed(result.quota.annualPenaltyAed)}
          </div>
        </div>
        <div
          className="rounded-xl p-3 border"
          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'الضوابط المستوفاة' : 'Implemented Controls'}
          </div>
          <div className="naf-mono font-bold mt-1">
            {isolateLtr(`${result.controls.filter((c) => c.implemented).length} / 6`)}
          </div>
        </div>
      </div>

      {/* Deterministic Findings */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {t.findingsTitle} ({result.findings.length})
        </h3>
        <ul className="space-y-1.5 text-xs">
          {result.findings.map((f, idx) => {
            const bg =
              f.severity === 'blocker'
                ? 'var(--accent-crimson-soft)'
                : f.severity === 'warning'
                  ? 'var(--accent-amber-soft)'
                  : 'var(--bg-soft)';
            const fg =
              f.severity === 'blocker'
                ? 'var(--accent-crimson)'
                : f.severity === 'warning'
                  ? 'var(--accent-amber)'
                  : 'var(--accent-primary)';
            return (
              <li
                key={`${f.code}-${idx}`}
                className="rounded-xl p-2.5 border flex items-start gap-2"
                style={{ backgroundColor: bg, borderColor: 'var(--border-subtle)' }}
              >
                <span className="naf-mono px-1.5 py-0.5 rounded font-bold text-[10px] shrink-0" style={{ color: fg }}>
                  {isolateLtr(`${f.severity.toUpperCase()} · ${f.code}`)}
                </span>
                <div>
                  <div className="font-bold">{isAr ? f.titleAr : f.titleEn}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{isAr ? f.detailAr : f.detailEn}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Optional Notes */}
      <label className="block space-y-1 no-print">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {isAr ? 'ملاحظات تشغيلية مرفقة بالملف' : 'Operational Dossier Notes'}
        </span>
        <textarea
          rows={2}
          disabled={locked}
          className="naf-input text-xs"
          placeholder={t.notesPlaceholder}
          value={input.notes ?? ''}
          onChange={(e) => onChange({ ...input, notes: e.target.value })}
        />
      </label>

      {/* SHA-256 Digest & Export Actions */}
      <div
        className="rounded-xl p-3 border space-y-3"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="text-xs">
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            SHA-256:{' '}
          </span>
          <span className="naf-mono break-all select-all text-[11px]">
            {activeDossier?.sha256Digest || result.dossierSha256}
          </span>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onDownloadMd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold cursor-pointer"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.downloadMd}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold cursor-pointer"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.downloadCsv}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold cursor-pointer"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.printA4}</span>
          </button>

          {shareTarget && (
            <button
              type="button"
              onClick={() => onOpenPublicRoute(shareTarget)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
              style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.openShareLink}</span>
              <span className="naf-mono text-[11px]">{isolateLtr(withBase(`/r/${shareTarget}`))}</span>
            </button>
          )}
        </div>
      </div>

      {/* Saved Dossiers Vault */}
      {savedDossiers.length > 0 && (
        <div className="no-print pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {t.savedDossiers} ({savedDossiers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {savedDossiers.map((d) => {
              const sMeta = STATUS_META[d.result.status];
              const isCurrent = activeDossier?.id === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDossier(d)}
                  className="text-start rounded-xl p-3 border transition cursor-pointer"
                  style={{
                    backgroundColor: isCurrent ? 'var(--bg-soft)' : 'var(--bg-elevated)',
                    borderColor: isCurrent ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{d.input.establishmentName}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: sMeta.bgVar, color: sMeta.textVar }}
                    >
                      {sMeta[lang]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    <span className="naf-mono font-bold">
                      {isolateLtr(d.dossierCode || (isAr ? 'مسودة' : 'DRAFT'))}
                    </span>
                    <span>·</span>
                    <span>{formatAed(d.result.quota.annualPenaltyAed)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
