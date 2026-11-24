import type { NafisPreset } from './types.ts';

const PRESET_3_PAYROLL_CSV = [
  'employee_id,full_name,nationality,role_tier,monthly_salary_aed,hire_date,registered_in_wps,registered_in_pension',
  'EMP-101,Hamad Al Mazrouei,AE,skilled,8200,2024-03-10,true,true',
  'EMP-102,Noura Al Suwaidi,AE,skilled,7800,2024-06-15,true,true',
  'EMP-103,Rashid Al Ketbi,AE,skilled,7400,2024-09-01,true,true',
  'EMP-104,Mariam Al Shamsi,AE,skilled,7100,2025-01-12,true,true',
  'EMP-105,Saeed Al Muhairi,AE,skilled,6900,2025-04-20,true,true',
  'EMP-106,Hessa Al Dhaheri,AE,skilled,6500,2025-07-05,true,true',
  'EMP-107,Khalifa Al Nuaimi,AE,skilled,6400,2025-10-18,true,true',
  'EMP-108,Shamma Al Qasimi,AE,skilled,6200,2026-02-01,true,true',
  'EMP-109,Sultan Al Mansoori,AE,skilled,4800,2026-03-15,true,true',
  'EMP-110,Maitha Al Falasi,AE,skilled,4800,2025-02-10,true,true',
].join('\n');

export const NAFIS_PRESETS: readonly NafisPreset[] = [
  {
    id: 'dubai-tech-50plus-10pct-compliant',
    labelAr: 'شركة تقنية في دبي (50+ مهارية — ممتثلة لمستهدف 10% نهاية 2026)',
    labelEn: 'Dubai Mainland Tech Firm (50+ Skilled — 10% End-2026 Compliant)',
    descriptionAr:
      '80 وظيفة مهارية بمستهدف 10% (8 مطلوبين) مع 9 مواطنين مؤهلين برواتب >= 6,000 د.إ وWPS وتقاعد كامل.',
    descriptionEn:
      '80 skilled roles targeting 10% (8 required) with 9 eligible Emiratis (>= AED 6,000, WPS & pension verified).',
    input: {
      establishmentName: 'Al Noor Cloud Solutions LLC (Dubai Mainland)',
      assessmentDate: '2026-12-31',
      scope: 'mainland_onshore',
      totalWorkforceCount: 110,
      skilledWorkforceCount: 80,
      sector: 'information_communications',
      activeEligibleEmiratis: 9,
      daysSinceRecentEmiratiResignation: null,
      implementedControls: [
        'NAF-CTRL-01',
        'NAF-CTRL-02',
        'NAF-CTRL-03',
        'NAF-CTRL-04',
        'NAF-CTRL-05',
        'NAF-CTRL-06',
      ],
    },
  },
  {
    id: 'midsize-logistics-20-49-backfill-conditional',
    labelAr: 'شركة لوجستيات (20–49 قطاع النقل — مهلة استبدال 45 يوماً)',
    labelEn: 'Midsize Logistics (20–49 Sector — 45-Day Resignation Backfill Grace)',
    descriptionAr:
      '35 موظفاً في قطاع النقل والتخزين (مطلوب مواطنان، متاح 1 مع شاغر منذ 45 يوماً ضمن مهلة الـ 60 يوماً دون استكمال ضابط الاستبدال).',
    descriptionEn:
      '35 staff in Transportation & Storage (2 Emiratis required, 1 active + 45d since resignation inside 60d grace window, missing backfill workflow).',
    input: {
      establishmentName: 'Emirates Horizon Logistics LLC (Abu Dhabi Mainland)',
      assessmentDate: '2026-12-31',
      scope: 'mainland_onshore',
      totalWorkforceCount: 35,
      skilledWorkforceCount: 22,
      sector: 'transportation_storage',
      activeEligibleEmiratis: 1,
      daysSinceRecentEmiratiResignation: 45,
      implementedControls: [
        'NAF-CTRL-01',
        'NAF-CTRL-02',
        'NAF-CTRL-03',
        'NAF-CTRL-04',
        'NAF-CTRL-06',
      ],
    },
  },
  {
    id: 'construction-shortfall-and-sub6k-blocked',
    labelAr: 'شركة مقاولات (120 مهارية — عجز 4 شواغر + 2 برواتب 4,800 د.إ مستبعدة)',
    labelEn: 'Construction Firm (120 Skilled — 4-Slot Shortfall + 2 Sub-AED 6k Excluded)',
    descriptionAr:
      'كشف CSV يضم 10 مواطنين منهم اثنان براتب 4,800 د.إ (يستبعدان)، ليبقى 8 من أصل 12 مطلوبين؛ العجز 4 شواغر بغرامة 480,000 د.إ/سنة.',
    descriptionEn:
      'Payroll CSV contains 10 Emiratis where 2 earn AED 4,800 (excluded), leaving 8 of 12 required -> 4 shortfall slots = AED 480,000/yr fine.',
    input: {
      establishmentName: 'Al Saqr Contracting & Civil Works LLC (Sharjah)',
      assessmentDate: '2026-12-31',
      scope: 'mainland_onshore',
      totalWorkforceCount: 165,
      skilledWorkforceCount: 120,
      sector: 'construction',
      payrollCsv: PRESET_3_PAYROLL_CSV,
      daysSinceRecentEmiratiResignation: null,
      implementedControls: ['NAF-CTRL-01', 'NAF-CTRL-03', 'NAF-CTRL-04'],
    },
  },
];
