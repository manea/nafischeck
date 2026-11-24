import { Building2, Save } from 'lucide-react';
import { DESIGNATED_14_SECTORS } from '../core/index.ts';
import type {
  AssessmentInput,
  EstablishmentScope,
  EstablishmentSector,
} from '../core/types.ts';
import type { EstablishmentProfile } from '../lib/api.ts';
import { UI_LABELS, type UiLang } from '../lib/i18n.ts';

interface Props {
  lang: UiLang;
  input: AssessmentInput;
  profiles: EstablishmentProfile[];
  locked: boolean;
  onChange: (next: AssessmentInput) => void;
  onSaveProfile: () => void;
}

export function EstablishmentScopePanel({
  lang,
  input,
  profiles,
  locked,
  onChange,
  onSaveProfile,
}: Props) {
  const t = UI_LABELS[lang];
  const isAr = lang === 'ar';
  const hasCsvOverride = typeof input.payrollCsv === 'string' && input.payrollCsv.trim().length > 0;

  return (
    <section className="naf-card rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Building2 className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <span>{t.scopeTitle}</span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t.scopeSub}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          {profiles.length > 0 && (
            <select
              aria-label={t.savedProfiles}
              className="naf-input text-xs py-1.5 w-auto"
              value=""
              disabled={locked}
              onChange={(e) => {
                const prof = profiles.find((p) => p.id === e.target.value);
                if (prof) {
                  onChange({
                    ...input,
                    establishmentName: prof.profile.establishmentName,
                    scope: prof.profile.scope,
                    sector: prof.profile.sector,
                    totalWorkforceCount: prof.profile.totalWorkforceCount,
                    skilledWorkforceCount: prof.profile.skilledWorkforceCount,
                    notes: prof.profile.notes,
                  });
                }
              }}
            >
              <option value="">{`${t.savedProfiles} (${profiles.length})`}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            disabled={locked}
            onClick={onSaveProfile}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t.saveProfile}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <label className="block space-y-1 lg:col-span-2">
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t.establishmentName}
          </span>
          <input
            type="text"
            disabled={locked}
            className="naf-input"
            value={input.establishmentName}
            onChange={(e) => onChange({ ...input, establishmentName: e.target.value })}
          />
        </label>

        <label className="block space-y-1">
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t.assessmentDate}
          </span>
          <input
            type="date"
            dir="ltr"
            disabled={locked}
            className="naf-input naf-mono text-start"
            value={input.assessmentDate}
            onChange={(e) => onChange({ ...input, assessmentDate: e.target.value || '2026-12-31' })}
          />
        </label>

        <label className="block space-y-1">
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t.scopeLabel}
          </span>
          <select
            disabled={locked}
            className="naf-input"
            value={input.scope}
            onChange={(e) =>
              onChange({ ...input, scope: e.target.value as EstablishmentScope })
            }
          >
            <option value="mainland_onshore">{t.scopeMainland}</option>
            <option value="freezone_exempt">{t.scopeFreezone}</option>
          </select>
        </label>

        <label className="block space-y-1 lg:col-span-2">
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t.sectorLabel}
          </span>
          <select
            disabled={locked}
            className="naf-input"
            value={input.sector}
            onChange={(e) =>
              onChange({ ...input, sector: e.target.value as EstablishmentSector })
            }
          >
            {DESIGNATED_14_SECTORS.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {`${sec.code}. ${isAr ? sec.nameAr : sec.nameEn}`}
              </option>
            ))}
            <option value="other_non_designated">{t.otherSector}</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t.totalWorkforce}
          </span>
          <input
            type="number"
            min={0}
            dir="ltr"
            disabled={locked}
            className="naf-input naf-mono"
            value={input.totalWorkforceCount}
            onChange={(e) =>
              onChange({
                ...input,
                totalWorkforceCount: Math.max(0, Math.floor(Number(e.target.value) || 0)),
              })
            }
          />
        </label>

        <label className="block space-y-1">
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t.skilledWorkforce}
          </span>
          <input
            type="number"
            min={0}
            dir="ltr"
            disabled={locked}
            className="naf-input naf-mono"
            value={input.skilledWorkforceCount}
            onChange={(e) =>
              onChange({
                ...input,
                skilledWorkforceCount: Math.max(0, Math.floor(Number(e.target.value) || 0)),
              })
            }
          />
        </label>

        <label className="block space-y-1 lg:col-span-2">
          <span className="font-semibold flex items-center justify-between gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span>{t.activeEmiratis}</span>
            {hasCsvOverride && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
              >
                {isAr ? 'محتسب من CSV' : 'Driven by CSV'}
              </span>
            )}
          </span>
          <input
            type="number"
            min={0}
            dir="ltr"
            disabled={locked || hasCsvOverride}
            className="naf-input naf-mono disabled:opacity-60"
            value={input.activeEligibleEmiratis ?? 0}
            onChange={(e) =>
              onChange({
                ...input,
                activeEligibleEmiratis: Math.max(0, Math.floor(Number(e.target.value) || 0)),
              })
            }
          />
        </label>

        <label className="block space-y-1 lg:col-span-2">
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t.resignationDays}
          </span>
          <input
            type="number"
            min={0}
            max={365}
            dir={input.daysSinceRecentEmiratiResignation != null ? 'ltr' : undefined}
            placeholder={isAr ? 'مثلاً 45 (مهلة 60 يوماً)' : 'e.g. 45 (60d grace)'}
            disabled={locked}
            className={input.daysSinceRecentEmiratiResignation != null ? 'naf-input naf-mono' : 'naf-input'}
            value={input.daysSinceRecentEmiratiResignation ?? ''}
            onChange={(e) =>
              onChange({
                ...input,
                daysSinceRecentEmiratiResignation:
                  e.target.value === ''
                    ? null
                    : Math.max(0, Math.floor(Number(e.target.value) || 0)),
              })
            }
          />
        </label>
      </div>
    </section>
  );
}
