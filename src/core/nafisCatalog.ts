import type {
  DesignatedSectorId,
  DesignatedSectorInfo,
  NafisControlSpec,
} from './types.ts';

export const NAFIS_TOOL_VERSION = '0.5.0';

export const EMIRATI_MIN_SALARY_AED = 6000;
export const MIN_SALARY_EFFECTIVE_DATE = '2026-01-01';
export const MIN_SALARY_GRACE_END_DATE = '2026-06-30';
export const BACKFILL_GRACE_DAYS = 60;

export const LEGAL_DISCLAIMER_AR =
  'تنبيه مهم: أداة NafisCheck أداة فحص وجاهزية تقنية مستقلة وليست تابعة أو معتمدة من وزارة الموارد البشرية والتوطين (MoHRE) أو برنامج «نافس». ولا تُعد مخرجاتها استشارة قانونية أو قراراً رسمياً، ويجب مراجعة ملفات المنشأة وكشوف الأجور الرسمية عبر بوابة الوزارة ومستشار قانوني مختص.';

export const LEGAL_DISCLAIMER_EN =
  'Notice: NafisCheck is an independent technical readiness tool and is NOT affiliated with or endorsed by the UAE Ministry of Human Resources & Emiratisation (MoHRE) or the Nafis program. Outputs do not constitute legal or HR counsel; verify official obligations through MoHRE portals and qualified legal counsel.';

export const DESIGNATED_14_SECTORS: readonly DesignatedSectorInfo[] = [
  {
    id: 'information_communications',
    code: 1,
    nameAr: 'المعلومات والاتصالات',
    nameEn: 'Information & Communications',
  },
  {
    id: 'financial_insurance',
    code: 2,
    nameAr: 'الأنشطة المالية وأنشطة التأمين',
    nameEn: 'Financial & Insurance Activities',
  },
  {
    id: 'real_estate',
    code: 3,
    nameAr: 'الأنشطة العقارية',
    nameEn: 'Real Estate Activities',
  },
  {
    id: 'professional_scientific_technical',
    code: 4,
    nameAr: 'الأنشطة المهنية والعلمية والتقنية',
    nameEn: 'Professional, Scientific & Technical Activities',
  },
  {
    id: 'administrative_support_services',
    code: 5,
    nameAr: 'أنشطة الخدمات الإدارية وخدمات الدعم',
    nameEn: 'Administrative & Support Services',
  },
  {
    id: 'arts_entertainment',
    code: 6,
    nameAr: 'الفنون والترفيه',
    nameEn: 'Arts & Entertainment',
  },
  {
    id: 'mining_quarrying',
    code: 7,
    nameAr: 'التعدين واستغلال المحاجر',
    nameEn: 'Mining & Quarrying',
  },
  {
    id: 'transformative_industries',
    code: 8,
    nameAr: 'الصناعات التحويلية',
    nameEn: 'Transformative Industries / Manufacturing',
  },
  {
    id: 'construction',
    code: 9,
    nameAr: 'التشييد والبناء',
    nameEn: 'Construction',
  },
  {
    id: 'wholesale_retail',
    code: 10,
    nameAr: 'تجارة الجملة والتجزئة',
    nameEn: 'Wholesale & Retail Trade',
  },
  {
    id: 'education',
    code: 11,
    nameAr: 'التعليم',
    nameEn: 'Education',
  },
  {
    id: 'human_health_social_work',
    code: 12,
    nameAr: 'أنشطة صحة الإنسان والخدمة الاجتماعية',
    nameEn: 'Human Health & Social Work Activities',
  },
  {
    id: 'transportation_storage',
    code: 13,
    nameAr: 'النقل والتخزين',
    nameEn: 'Transportation & Storage',
  },
  {
    id: 'hospitality_residency_services',
    code: 14,
    nameAr: 'أنشطة خدمات الإقامة والطعام (الضيافة)',
    nameEn: 'Hospitality & Residency / Food Services',
  },
];

export const DESIGNATED_SECTOR_IDS: ReadonlySet<DesignatedSectorId> = new Set(
  DESIGNATED_14_SECTORS.map((sector) => sector.id),
);

export const NAFIS_CONTROLS: readonly NafisControlSpec[] = [
  {
    id: 'NAF-CTRL-01',
    weight: 20,
    titleAr: 'تتبع مستهدف التوطين نصف السنوي وتصنيف الوظائف المهارية',
    titleEn: 'Semi-Annual Emiratisation Target & Skilled Role Tracking',
    descriptionAr:
      'تصنيف الموظفين ضمن المستويات المهارية 1–5 وفق ISCO والتحقق من الوصول إلى 10% نهاية 2026 للمنشآت 50+ أو توظيف مواطنين في فئة 20–49 للقطاعات الـ 14.',
    descriptionEn:
      'Classify ISCO Level 1–5 skilled roles and track H1/H2 quotas up to 10% by end-2026 (50+) or 2 citizens in the 14 sectors (20–49).',
  },
  {
    id: 'NAF-CTRL-02',
    weight: 20,
    titleAr: 'الالتزام بالحد الأدنى لأجر المواطن (6,000 د.إ شهرياً)',
    titleEn: 'AED 6,000 Minimum Monthly Emirati Salary Threshold',
    descriptionAr:
      'ضمان أن يكون الأجر الشهري لكل موظف مواطن مسجل >= 6,000 د.إ (نافذ منذ 2026-01-01 وانتهاء مهلة تعديل العقود في 2026-06-30).',
    descriptionEn:
      'Enforce AED 6,000/month minimum Emirati salary (effective 2026-01-01; existing contract grace closed 2026-06-30).',
  },
  {
    id: 'NAF-CTRL-03',
    weight: 20,
    titleAr: 'تحويل الرواتب عبر نظام حماية الأجور (WPS)',
    titleEn: 'Wage Protection System (WPS) Verified Payroll',
    descriptionAr:
      'توثيق سداد رواتب المواطنين شهرياً عبر نظام حماية الأجور لتجنب استبعادهم من احتساب النسبة.',
    descriptionEn:
      'Route all Emirati payroll salaries through MoHRE WPS to retain quota eligibility.',
  },
  {
    id: 'NAF-CTRL-04',
    weight: 15,
    titleAr: 'التسجيل والالتزام في صندوق التقاعد (GPSSA / ADPF)',
    titleEn: 'Pension Registration (GPSSA / ADPF) & Active Contributions',
    descriptionAr:
      'تسجيل الموظف المواطن في الهيئة العامة للمعاشات أو صندوق أبوظبي للمعاشات وسداد الاشتراكات في مواعيدها.',
    descriptionEn:
      'Maintain active GPSSA or Abu Dhabi Pension Fund enrollment and timely contributions.',
  },
  {
    id: 'NAF-CTRL-05',
    weight: 15,
    titleAr: 'سير عمل الاستبدال خلال مهلة الـ 60 يوماً عند الاستقالة',
    titleEn: '60-Day Emirati Resignation Backfill Workflow',
    descriptionAr:
      'رصد أي شاغر توطين فور انتهاء خدمة المواطن واستبداله خلال 60 يوماً لتفادي الغرامات التلقائية.',
    descriptionEn:
      'Track Emirati departures immediately and fill replacement vacancies within the 60-day MoHRE grace window.',
  },
  {
    id: 'NAF-CTRL-06',
    weight: 10,
    titleAr: 'سجل التحقق من التوطين الحقيقي ومكافحة التوطين الصوري',
    titleEn: 'Authentic Employment & Anti-Fictitious Emiratisation Trail',
    descriptionAr:
      'توثيق المهام الفعلية والحضور وساعات العمل لمطابقة متطلبات التفتيش في MoHRE ونافس ومنع غرامات التوطين الصوري.',
    descriptionEn:
      'Retain attendance, job scope, and work output logs to demonstrate genuine employment during MoHRE/Nafis audits.',
  },
];
