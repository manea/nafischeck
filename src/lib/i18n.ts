import type { NafisTier, ReadinessStatus } from '../core/types.ts';

export type UiLang = 'ar' | 'en';
export type UiTheme = 'sovereign-pearl' | 'abu-dhabi-night';

/** Isolates LTR tokens inside Arabic RTL prose so dates, AED figures, and NAF codes render cleanly. */
export function isolateLtr(value: string | number): string {
  return `\u2066${String(value)}\u2069`;
}

export function formatAed(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return isolateLtr(`AED ${Math.round(n).toLocaleString('en-US')}`);
}

export const TIER_LABELS: Record<NafisTier, { ar: string; en: string }> = {
  large_50_plus: {
    ar: 'منشآت 50+ وظيفة مهارية (حتى 10%)',
    en: '50+ Skilled Workforce Tier (up to 10%)',
  },
  medium_20_49_designated: {
    ar: 'منشآت 20–49 ضمن القطاعات الـ 14 (2 مواطنين)',
    en: '20–49 Designated 14-Sector Tier (2 Citizens)',
  },
  exempt_scope: {
    ar: 'معفى / دون حد الإلزام الاتحادي',
    en: 'Exempt / Below Federal Quota Threshold',
  },
};

export const STATUS_META: Record<
  ReadinessStatus,
  { ar: string; en: string; bgVar: string; textVar: string }
> = {
  ready: {
    ar: 'جاهز / ممتثل',
    en: 'READY / COMPLIANT',
    bgVar: 'var(--accent-teal-soft)',
    textVar: 'var(--accent-teal)',
  },
  conditional: {
    ar: 'جاهزية مشروطة',
    en: 'CONDITIONAL REVIEW',
    bgVar: 'var(--accent-amber-soft)',
    textVar: 'var(--accent-amber)',
  },
  blocked: {
    ar: 'غير ممتثل / خطر غرامة',
    en: 'BLOCKED / PENALTY RISK',
    bgVar: 'var(--accent-crimson-soft)',
    textVar: 'var(--accent-crimson)',
  },
};

export const PRESET_EXPECTED_STATUS: Record<string, ReadinessStatus> = {
  'dubai-tech-50plus-10pct-compliant': 'ready',
  'midsize-logistics-20-49-backfill-conditional': 'conditional',
  'construction-shortfall-and-sub6k-blocked': 'blocked',
};

export const UI_LABELS = {
  ar: {
    appName: 'NafisCheck | مدقق التوطين ونافس',
    subtitle: 'محاكي مستهدف التوطين الإماراتي 10% (2026-12-31) وقاعدة الـ 14 قطاعاً وحد الأجر AED 6,000',
    sqliteMode: 'متصل بقاعدة SQLite WAL',
    localMode: 'وضع المتصفح المحلي $0',
    themeLight: 'لؤلؤة السيادة',
    themeDark: 'أبوظبي الليلي',
    langToggle: 'English LTR',
    presetsTitle: 'حزم سيناريوهات إماراتية جاهزة (تدقيق بنقرة واحدة)',
    chartTitle: 'التحليل البصري لنصاب التوطين والغرامات',
    chartSub: 'مقارنة الموظفين المواطنين المؤهلين بالمطلوب تنظيمياً والالتزام المالي السنوي',
    scopeTitle: '1. بيانات المنشأة والقطاع ونطاق التوطين',
    scopeSub: 'نصاب 50+ يتدرج نصف سنوياً حتى 10% · منشآت 20–49 للقطاعات الـ 14 بمواطنين · مهلة استبدال 60 يوماً',
    establishmentName: 'اسم المنشأة / الشركة',
    assessmentDate: `تاريخ التقييم (${isolateLtr('2026-12-31')})`,
    scopeLabel: 'النطاق التنظيمي في الإمارات',
    scopeMainland: 'البر الرئيسي (MoHRE Onshore)',
    scopeFreezone: 'منطقة حرة معفاة (DIFC / ADGM / Free Zone)',
    sectorLabel: 'القطاع الاقتصادي (مهم لفئة 20–49)',
    otherSector: 'قطاع آخر خارج القائمة الـ 14',
    totalWorkforce: 'إجمالي القوى العاملة بالمنشأة',
    skilledWorkforce: 'عدد الوظائف المهارية (المستويات 1–5)',
    activeEmiratis: 'عدد المواطنين المؤهلين الفعليين (أجر >= 6,000 + WPS + تقاعد)',
    resignationDays: 'أيام منذ آخر استقالة/إنهاء خدمة لمواطن (إن وجدت، مهلة 60 يوماً)',
    saveProfile: 'حفظ كملف منشأة',
    savedProfiles: 'ملفات المنشآت المحفوظة',
    controlsTitle: '2. الضوابط التشغيلية الستة ومدقق كشف الرواتب CSV',
    controlsSub: 'الحد الأدنى لأجر المواطن AED 6,000 منذ 2026-01-01 (انتهاء توفيق العقود 2026-06-30) مع حماية WPS والتقاعد.',
    controlsChecklist: 'مصفوفة ضوابط وزارة الموارد البشرية ونافس (6 ضوابط)',
    payrollTitle: 'مدقق كشف رواتب المواطنين CSV وحماية CWE-1236',
    payrollSub: 'ارفع أو ألصق كشف الموظفين لاكتشاف الأجور الأقل من 6,000 د.إ ونقص WPS والتقاعد تلقائياً.',
    loadSampleCsv: 'تحميل عينة كشف مع رواتب 4,800 د.إ',
    clearCsv: 'مسح الكشف والاعتماد على العدد اليدوي',
    uploadCsv: 'رفع ملف CSV',
    exportSafeCsv: 'تصدير CSV آمن (UTF-8 BOM)',
    dossierTitle: '3. ملف جاهزية التوطين والختم الذري',
    saveDraft: 'حفظ مسودة الملف',
    sealDossier: 'ختم الملف برمز NAF رسمي',
    duplicateDraft: 'نسخ كمسودة قابلة للتعديل',
    deleteDraft: 'حذف المسودة',
    downloadMd: 'تحميل التقرير (.md)',
    downloadCsv: 'تحميل CSV الآمن',
    openShareLink: 'فتح صفحة المشاركة العامة',
    printA4: 'طباعة / حفظ PDF A4',
    savedDossiers: 'خزينة ملفات الجاهزية المحفوظة',
    findingsTitle: 'نتائج التدقيق التنظيمي الحتمية',
    notesPlaceholder: 'ملاحظات الموارد البشرية أو خطة استقطاب وتوطين الكوادر الإماراتية...',
    disclaimerLabel: 'تنويه تنظيمي إلزامي',
    publicBack: 'العودة إلى أستوديو NafisCheck التفاعلي',
  },
  en: {
    appName: 'NafisCheck | UAE Emiratisation Auditor',
    subtitle: 'MoHRE / Nafis 10% Target Simulator (2026-12-31), 20–49 14-Sector Rule & AED 6,000 Salary Auditor',
    sqliteMode: 'SQLite WAL Connected',
    localMode: '$0 Local Browser Mode',
    themeLight: 'Sovereign Pearl',
    themeDark: 'Abu Dhabi Night',
    langToggle: 'العربية RTL',
    presetsTitle: 'UAE Scenario Presets (One-Click Audit)',
    chartTitle: 'Emiratisation Quota & Penalty Exposure Audit',
    chartSub: 'Eligible Emirati headcount against semi-annual target & annual statutory contribution',
    scopeTitle: '1. Establishment Scope, Sector & Workforce Counts',
    scopeSub: '50+ skilled hits 10% on 2026-12-31 · 20–49 14 sectors require 2 citizens · 60-day backfill grace',
    establishmentName: 'Establishment / Legal Entity Name',
    assessmentDate: 'Assessment Date (Target: 2026-12-31)',
    scopeLabel: 'UAE Regulatory Jurisdiction Scope',
    scopeMainland: 'UAE Mainland (MoHRE Onshore)',
    scopeFreezone: 'Exempt Free Zone (DIFC / ADGM / Free Zone)',
    sectorLabel: 'Economic Activity Sector (20–49 Mandate)',
    otherSector: 'Other Sector (Outside Designated 14)',
    totalWorkforce: 'Total Establishment Headcount',
    skilledWorkforce: 'Skilled Workforce Count (ISCO Levels 1–5)',
    activeEmiratis: 'Manual Active Eligible Emiratis (>= AED 6k + WPS + Pension)',
    resignationDays: 'Days Since Recent Emirati Departure (60-Day Grace Window)',
    saveProfile: 'Save Profile',
    savedProfiles: 'Saved Establishment Profiles',
    controlsTitle: '2. Six Operational Controls & Emirati Payroll CSV Auditor',
    controlsSub: 'AED 6,000 minimum Emirati salary effective 2026-01-01 (contract grace closed 2026-06-30) + WPS & GPSSA/ADPF.',
    controlsChecklist: 'MoHRE / Nafis Operational Readiness Controls (6 Controls)',
    payrollTitle: 'Emirati Payroll CSV Auditor & CWE-1236 Safe Exporter',
    payrollSub: 'Paste or upload employee CSV to automatically flag sub-AED 6,000 salaries, missing WPS, or missing pension.',
    loadSampleCsv: 'Load Sample CSV (Includes 4,800 AED Rows)',
    clearCsv: 'Clear CSV (Use Manual Count)',
    uploadCsv: 'Upload CSV File',
    exportSafeCsv: 'Export Safe BOM CSV',
    dossierTitle: '3. Canonical Readiness Dossier & Atomic Lock',
    saveDraft: 'Save Draft Dossier',
    sealDossier: 'Seal & Stamp NAF Code',
    duplicateDraft: 'Duplicate Editable Draft',
    deleteDraft: 'Delete Draft',
    downloadMd: 'Download Brief (.md)',
    downloadCsv: 'Download Safe CSV',
    openShareLink: 'Open Public Share View',
    printA4: 'Print / Save A4 PDF',
    savedDossiers: 'Saved Dossiers Vault',
    findingsTitle: 'Deterministic Compliance Findings',
    notesPlaceholder: 'Optional HR Emiratisation hiring plan or MoHRE audit notes...',
    disclaimerLabel: 'Mandatory Operational Notice',
    publicBack: 'Back to Interactive NafisCheck Studio',
  },
} as const;
