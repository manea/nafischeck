import { ArrowLeft, Database, HardDrive, Languages, Moon, Printer, ShieldCheck, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ControlsAndPayrollPanel } from './components/ControlsAndPayrollPanel.tsx';
import { DossierPreviewAndPrint } from './components/DossierPreviewAndPrint.tsx';
import { EstablishmentScopePanel } from './components/EstablishmentScopePanel.tsx';
import { NafisQuotaAndFineSvg } from './components/NafisQuotaAndFineSvg.tsx';
import { NAFIS_PRESETS, assessNafisReadiness } from './core/index.ts';
import type { AssessmentInput, AssessmentResult } from './core/types.ts';
import {
  type ApiMode,
  type DossierBundle,
  type EstablishmentProfile,
  type StoredDossier,
  createDossierFromInput,
  deleteDraftDossier,
  detectApiMode,
  downloadBriefMarkdown,
  downloadSafeBomCsv,
  duplicateDossier,
  finalizeDossier,
  listDossiers,
  listProfiles,
  loadPublicReport,
  saveEstablishmentProfile,
  updateDossierInput,
} from './lib/api.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import {
  PRESET_EXPECTED_STATUS,
  STATUS_META,
  UI_LABELS,
  type UiLang,
  type UiTheme,
} from './lib/i18n.ts';

function extractPublicRouteSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const rel = stripBase(window.location.pathname);
  const match = rel.match(/^\/r\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1] || '') : null;
}

export default function App() {
  const [lang, setLang] = useState<UiLang>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('nafischeck.v1.lang') === 'en'
      ? 'en'
      : 'ar',
  );
  const [theme, setTheme] = useState<UiTheme>(() =>
    typeof window !== 'undefined' &&
    window.localStorage.getItem('nafischeck.v1.theme') === 'abu-dhabi-night'
      ? 'abu-dhabi-night'
      : 'sovereign-pearl',
  );
  const [mode, setMode] = useState<ApiMode>('local');

  const [presetKey, setPresetKey] = useState<string>(NAFIS_PRESETS[0]!.id);
  const [input, setInput] = useState<AssessmentInput>(NAFIS_PRESETS[0]!.input);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [evalError, setEvalError] = useState<string>('');

  const [savedDossiers, setSavedDossiers] = useState<StoredDossier[]>([]);
  const [profiles, setProfiles] = useState<EstablishmentProfile[]>([]);
  const [activeDossier, setActiveDossier] = useState<StoredDossier | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [toast, setToast] = useState<string>('');

  const [publicSlug, setPublicSlug] = useState<string | null>(() => extractPublicRouteSlug());
  const [publicBundle, setPublicBundle] = useState<
    (DossierBundle & { markdownAr: string; markdownEn: string }) | null
  >(null);
  const [publicLoading, setPublicLoading] = useState<boolean>(false);

  const t = UI_LABELS[lang];
  const isAr = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('nafischeck.v1.lang', lang);
      window.localStorage.setItem('nafischeck.v1.theme', theme);
    } catch {
      // ignore storage quota errors
    }
  }, [lang, isAr, theme]);

  useEffect(() => {
    const onPopState = () => setPublicSlug(extractPublicRouteSlug());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const detected = await detectApiMode();
      if (!active) return;
      setMode(detected);
      try {
        const [dList, pList] = await Promise.all([listDossiers(detected), listProfiles(detected)]);
        if (!active) return;
        setSavedDossiers(dList);
        setProfiles(pList);
      } catch {
        // ignore initial storage errors
      }
      const slugNow = extractPublicRouteSlug();
      if (slugNow) {
        setPublicLoading(true);
        const loaded = await loadPublicReport(detected, slugNow);
        if (active) {
          setPublicBundle(loaded);
          setPublicLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    assessNafisReadiness(input)
      .then((res) => {
        if (!cancelled) {
          setResult(res);
          setEvalError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEvalError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [input]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? '' : cur)), 3200);
  };

  const refreshSavedLists = async (m: ApiMode) => {
    const [dList, pList] = await Promise.all([listDossiers(m), listProfiles(m)]);
    setSavedDossiers(dList);
    setProfiles(pList);
  };

  const navigatePublic = async (slugOrCode: string | null) => {
    if (!slugOrCode) {
      window.history.pushState({}, '', withBase('/'));
      setPublicSlug(null);
      setPublicBundle(null);
      return;
    }
    window.history.pushState({}, '', withBase(`/r/${encodeURIComponent(slugOrCode)}`));
    setPublicSlug(slugOrCode);
    setPublicLoading(true);
    const loaded = await loadPublicReport(mode, slugOrCode);
    setPublicBundle(loaded);
    setPublicLoading(false);
  };

  if (publicSlug) {
    const pubDossier = publicBundle?.dossier;
    const pubStatus = pubDossier ? STATUS_META[pubDossier.result.status] : null;
    return (
      <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto space-y-5">
        <header className="no-print flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigatePublic(null)}
            className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-xl border cursor-pointer"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.publicBack}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t.langToggle}
              title={t.langToggle}
              onClick={() => setLang((l) => (l === 'ar' ? 'en' : 'ar'))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{t.langToggle}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t.printA4}</span>
            </button>
          </div>
        </header>

        {publicLoading ? (
          <div className="naf-card rounded-2xl p-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isAr ? 'جاري تحميل ملف الجاهزية العام...' : 'Loading public NafisCheck dossier...'}
          </div>
        ) : !pubDossier || !pubStatus ? (
          <div className="naf-card rounded-2xl p-8 text-center text-sm" style={{ color: 'var(--accent-crimson)' }}>
            {isAr ? 'لم يتم العثور على ملف الجاهزية المطلوب.' : `Public dossier "${publicSlug}" not found.`}
          </div>
        ) : (
          <article className="naf-card print-only-sheet rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-extrabold">
                  NafisCheck — {pubDossier.dossierCode || pubDossier.slug}
                </h1>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {pubDossier.input.establishmentName}
                </p>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: pubStatus.bgVar, color: pubStatus.textVar }}
              >
                {pubStatus[lang]} ({pubDossier.result.readinessScore}/100)
              </span>
            </div>

            <pre
              className="whitespace-pre-wrap text-xs leading-relaxed p-4 rounded-xl border overflow-x-auto"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              {isAr ? publicBundle.markdownAr : publicBundle.markdownEn}
            </pre>
          </article>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Non-sticky Header to avoid mobile overlap during scrolling */}
      <header
        className="no-print border-b"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base md:text-lg font-extrabold truncate">{t.appName}</h1>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
                >
                  {mode === 'server' ? <Database className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                  <span>{mode === 'server' ? t.sqliteMode : t.localMode}</span>
                </span>
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label={t.langToggle}
              title={t.langToggle}
              onClick={() => setLang((l) => (l === 'ar' ? 'en' : 'ar'))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{t.langToggle}</span>
            </button>

            <button
              type="button"
              aria-label={theme === 'sovereign-pearl' ? t.themeDark : t.themeLight}
              title={theme === 'sovereign-pearl' ? t.themeDark : t.themeLight}
              onClick={() =>
                setTheme((cur) =>
                  cur === 'sovereign-pearl' ? 'abu-dhabi-night' : 'sovereign-pearl',
                )
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              {theme === 'sovereign-pearl' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {theme === 'sovereign-pearl' ? t.themeDark : t.themeLight}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {toast && (
          <div
            className="no-print rounded-xl px-4 py-2.5 text-xs font-semibold border"
            style={{ backgroundColor: 'var(--bg-soft)', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
          >
            {toast}
          </div>
        )}

        {evalError && (
          <div
            className="no-print rounded-xl px-4 py-2.5 text-xs font-semibold border"
            style={{ backgroundColor: 'var(--accent-crimson-soft)', borderColor: 'var(--accent-crimson)', color: 'var(--accent-crimson)' }}
          >
            {evalError}
          </div>
        )}

        {/* Preset Scenario Bar */}
        <section className="no-print space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {t.presetsTitle}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {NAFIS_PRESETS.map((preset) => {
              const selected = !activeDossier && presetKey === preset.id;
              const meta = STATUS_META[PRESET_EXPECTED_STATUS[preset.id] || 'conditional'];
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setActiveDossier(null);
                    setPresetKey(preset.id);
                    setInput(preset.input);
                  }}
                  className="naf-card text-start rounded-2xl p-4 transition cursor-pointer"
                  style={{
                    borderColor: selected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    backgroundColor: selected ? 'var(--bg-soft)' : 'var(--bg-surface)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: meta.bgVar, color: meta.textVar }}
                    >
                      {meta[lang]}
                    </span>
                  </div>
                  <div className="text-sm font-bold">{isAr ? preset.labelAr : preset.labelEn}</div>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {isAr ? preset.descriptionAr : preset.descriptionEn}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {result && (
          <>
            <NafisQuotaAndFineSvg lang={lang} result={result} />

            <EstablishmentScopePanel
              lang={lang}
              input={input}
              profiles={profiles}
              locked={activeDossier?.status === 'locked'}
              onChange={setInput}
              onSaveProfile={async () => {
                setBusy(true);
                try {
                  await saveEstablishmentProfile(mode, input);
                  await refreshSavedLists(mode);
                  showToast(isAr ? 'تم حفظ ملف المنشأة بنجاح.' : 'Establishment profile saved.');
                } finally {
                  setBusy(false);
                }
              }}
            />

            <ControlsAndPayrollPanel
              lang={lang}
              input={input}
              result={result}
              controls={result.controls}
              locked={activeDossier?.status === 'locked'}
              onChange={setInput}
            />

            <DossierPreviewAndPrint
              lang={lang}
              input={input}
              result={result}
              activeDossier={activeDossier}
              savedDossiers={savedDossiers}
              busy={busy}
              onChange={setInput}
              onSaveDraft={async () => {
                setBusy(true);
                try {
                  const bundle = activeDossier
                    ? await updateDossierInput(mode, activeDossier.id, input, lang)
                    : await createDossierFromInput(mode, input, lang, presetKey);
                  setActiveDossier(bundle.dossier);
                  await refreshSavedLists(mode);
                  showToast(isAr ? 'تم حفظ مسودة الملف بنجاح.' : 'Draft dossier saved.');
                } finally {
                  setBusy(false);
                }
              }}
              onSealDossier={async () => {
                setBusy(true);
                try {
                  let targetId = activeDossier?.id;
                  if (!targetId) {
                    const created = await createDossierFromInput(mode, input, lang, presetKey);
                    targetId = created.dossier.id;
                  } else {
                    await updateDossierInput(mode, targetId, input, lang);
                  }
                  const sealed = await finalizeDossier(mode, targetId);
                  setActiveDossier(sealed.dossier);
                  await refreshSavedLists(mode);
                  showToast(
                    isAr
                      ? `تم ختم الملف بالرمز ${sealed.dossier.dossierCode}`
                      : `Dossier sealed as ${sealed.dossier.dossierCode}`,
                  );
                } finally {
                  setBusy(false);
                }
              }}
              onDuplicateDraft={async () => {
                if (!activeDossier) return;
                setBusy(true);
                try {
                  const cloned = await duplicateDossier(mode, activeDossier.id);
                  setActiveDossier(cloned.dossier);
                  setInput(cloned.dossier.input);
                  await refreshSavedLists(mode);
                  showToast(isAr ? 'تم إنشاء نسخة مسودة قابلة للتعديل.' : 'Editable draft copy created.');
                } finally {
                  setBusy(false);
                }
              }}
              onDeleteDraft={async () => {
                if (!activeDossier || activeDossier.status === 'locked') return;
                setBusy(true);
                try {
                  await deleteDraftDossier(mode, activeDossier.id);
                  setActiveDossier(null);
                  await refreshSavedLists(mode);
                  showToast(isAr ? 'تم حذف المسودة.' : 'Draft dossier deleted.');
                } finally {
                  setBusy(false);
                }
              }}
              onSelectDossier={(d) => {
                setActiveDossier(d);
                setInput(d.input);
              }}
              onDownloadMd={() => {
                const draftPlaceholder: StoredDossier = activeDossier ?? {
                  id: 'draft',
                  presetKey,
                  slug: 'draft',
                  dossierCode: 'DRAFT',
                  status: 'draft',
                  localeDefault: lang,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  lockedAt: null,
                  sha256Digest: result.dossierSha256,
                  viewCount: 0,
                  input,
                  result,
                };
                void downloadBriefMarkdown(draftPlaceholder, lang);
              }}
              onDownloadCsv={() =>
                downloadSafeBomCsv(
                  input,
                  result,
                  activeDossier?.dossierCode || input.establishmentName,
                )
              }
              onOpenPublicRoute={(slugOrCode) => void navigatePublic(slugOrCode)}
            />
          </>
        )}
      </main>
    </div>
  );
}
