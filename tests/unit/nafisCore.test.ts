import { describe, expect, it } from 'vitest';
import {
  NAFIS_PRESETS,
  assessNafisReadiness,
  auditEmiratiPayrollCsv,
  DESIGNATED_14_SECTORS,
  evaluateNafisQuota,
  exportPayrollAuditCsv,
  getMonthlySlotPenaltyAed,
  getSemiAnnualTargetPct,
  sanitizeCsvCell,
} from '../../src/core/index.ts';

describe('50+ Skilled Semi-Annual Quota Engine', () => {
  it('progresses semi-annually to 9% on 2026-06-30 and 10% on 2026-12-31', () => {
    expect(getSemiAnnualTargetPct('2024-12-31')).toBe(6);
    expect(getSemiAnnualTargetPct('2025-12-31')).toBe(8);
    expect(getSemiAnnualTargetPct('2026-06-30')).toBe(9);
    expect(getSemiAnnualTargetPct('2026-12-31')).toBe(10);
    expect(getMonthlySlotPenaltyAed('2026-12-31')).toBe(10000);
  });

  it('calculates ceiling Emirati quota and AED 120,000/yr fine per shortfall slot', () => {
    const quota = evaluateNafisQuota(
      {
        establishmentName: 'Gulf Precision Systems LLC',
        assessmentDate: '2026-12-31',
        scope: 'mainland_onshore',
        totalWorkforceCount: 75,
        skilledWorkforceCount: 55,
        sector: 'transformative_industries',
        implementedControls: ['NAF-CTRL-01'],
      },
      4,
    );

    expect(quota.tier).toBe('large_50_plus');
    expect(quota.targetRatePct).toBe(10);
    expect(quota.requiredEmiratis).toBe(6); // Math.ceil(55 * 0.10)
    expect(quota.shortfallSlots).toBe(2);
    expect(quota.monthlyPenaltyAed).toBe(20000);
    expect(quota.annualPenaltyAed).toBe(240000);
    expect(quota.findings.some((f) => f.code === 'NAF-QUOTA-SHORTFALL')).toBe(
      true,
    );
  });

  it('exempts free zone entities from federal MoHRE quotas', () => {
    const quota = evaluateNafisQuota(
      {
        establishmentName: 'DIFC Advisory Ltd',
        assessmentDate: '2026-12-31',
        scope: 'freezone_exempt',
        totalWorkforceCount: 150,
        skilledWorkforceCount: 140,
        sector: 'financial_insurance',
        implementedControls: [],
      },
      0,
    );

    expect(quota.tier).toBe('exempt_scope');
    expect(quota.requiredEmiratis).toBe(0);
    expect(quota.annualPenaltyAed).toBe(0);
    expect(quota.findings[0]?.code).toBe('NAF-FREEZONE-EXEMPT');
  });
});

describe('20–49 Designated 14-Sector Rule & Backfill Grace', () => {
  it('lists all 14 official targeted MoHRE sectors and enforces 2 citizens in 2026', () => {
    expect(DESIGNATED_14_SECTORS).toHaveLength(14);

    const quota = evaluateNafisQuota(
      {
        establishmentName: 'Abu Dhabi MedCare Clinic',
        assessmentDate: '2026-12-31',
        scope: 'mainland_onshore',
        totalWorkforceCount: 28,
        skilledWorkforceCount: 18,
        sector: 'human_health_social_work',
        implementedControls: ['NAF-CTRL-01'],
      },
      1,
    );

    expect(quota.tier).toBe('medium_20_49_designated');
    expect(quota.requiredEmiratis).toBe(2);
    expect(quota.shortfallSlots).toBe(1);
    expect(quota.annualPenaltyAed).toBe(108000);
    expect(quota.graceBackfillActive).toBe(false);
  });

  it('grants zero immediate penalty during the 60-day backfill grace while tracking exposure', () => {
    const quota = evaluateNafisQuota(
      {
        establishmentName: 'Al Ain Express Transport',
        assessmentDate: '2026-12-31',
        scope: 'mainland_onshore',
        totalWorkforceCount: 35,
        skilledWorkforceCount: 20,
        sector: 'transportation_storage',
        daysSinceRecentEmiratiResignation: 45,
        implementedControls: ['NAF-CTRL-01'],
      },
      1,
    );

    expect(quota.graceBackfillActive).toBe(true);
    expect(quota.backfillDaysRemaining).toBe(15);
    expect(quota.annualPenaltyAed).toBe(0);
    expect(quota.potentialAnnualPenaltyAed).toBe(108000);
  });

  it('treats non-designated 20–49 sectors under 50 skilled roles as exempt', () => {
    const quota = evaluateNafisQuota(
      {
        establishmentName: 'Desert Dates Farm LLC',
        assessmentDate: '2026-12-31',
        scope: 'mainland_onshore',
        totalWorkforceCount: 30,
        skilledWorkforceCount: 12,
        sector: 'other_non_designated',
        implementedControls: [],
      },
      0,
    );

    expect(quota.tier).toBe('exempt_scope');
    expect(quota.annualPenaltyAed).toBe(0);
  });
});

describe('AED 6,000 Emirati Payroll & CSV Auditor (CWE-1236)', () => {
  it('excludes sub-6k salaries post-June 2026, missing WPS, and missing pension records', () => {
    const csv = [
      'employee_id,full_name,nationality,role_tier,monthly_salary_aed,hire_date,registered_in_wps,registered_in_pension',
      'E-1,Valid Citizen,AE,skilled,6000,2026-07-01,true,true',
      'E-2,Sub 6k Post Grace,AE,skilled,5500,2024-01-10,true,true',
      'E-3,No WPS Citizen,AE,skilled,8000,2025-05-01,false,true',
      'E-4,No Pension Citizen,AE,skilled,7500,2025-05-01,true,false',
      'E-5,Expat Engineer,IN,skilled,9000,2024-01-01,true,true',
    ].join('\n');

    const audit = auditEmiratiPayrollCsv(csv, '2026-12-31');
    expect(audit.totalRows).toBe(5);
    expect(audit.emiratiRows).toBe(4);
    expect(audit.eligibleEmiratiCount).toBe(1);
    expect(audit.excludedSub6kCount).toBe(1);
    expect(audit.missingWpsCount).toBe(1);
    expect(audit.missingPensionCount).toBe(1);
  });

  it('flags pre-2026 sub-6k contracts as adjustment grace warnings in H1 2026', () => {
    const csv = [
      'employee_id,full_name,nationality,role_tier,monthly_salary_aed,hire_date,registered_in_wps,registered_in_pension',
      'E-10,Legacy Staff,AE,skilled,5200,2024-08-01,true,true',
      'E-11,New 2026 Hire,AE,skilled,5200,2026-02-01,true,true',
    ].join('\n');

    const audit = auditEmiratiPayrollCsv(csv, '2026-04-15');
    expect(audit.graceWarningCount).toBe(1);
    expect(audit.excludedSub6kCount).toBe(1);
    expect(audit.eligibleEmiratiCount).toBe(1);
  });

  it('sanitizes formula payloads against CWE-1236 and prepends UTF-8 BOM on export', () => {
    expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
    expect(sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(sanitizeCsvCell('+1+1')).toBe("'+1+1");
    expect(sanitizeCsvCell('-2*3')).toBe("'-2*3");
    expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");

    const csv = [
      'employee_id,full_name,nationality,role_tier,monthly_salary_aed,hire_date,registered_in_wps,registered_in_pension',
      'E-99,"=HYPERLINK(""http://evil"")",AE,skilled,6500,2025-01-01,true,true',
    ].join('\n');

    const audit = auditEmiratiPayrollCsv(csv, '2026-12-31');
    const exported = exportPayrollAuditCsv(audit);
    expect(exported.startsWith('\uFEFF')).toBe(true);
    expect(exported).toContain('"\'=HYPERLINK(""http://evil"")"');
  });
});

describe('Nafis Readiness Presets, SHA-256 Digest & Non-MoHRE Disclaimer', () => {
  it('evaluates all 3 NAFIS_PRESETS with exact expected status, penalties, digest, and disclaimers', async () => {
    expect(NAFIS_PRESETS).toHaveLength(3);

    const readyResult = await assessNafisReadiness(NAFIS_PRESETS[0]!.input);
    expect(readyResult.status).toBe('ready');
    expect(readyResult.readinessScore).toBe(100);
    expect(readyResult.quota.requiredEmiratis).toBe(8);
    expect(readyResult.quota.shortfallSlots).toBe(0);
    expect(readyResult.quota.annualPenaltyAed).toBe(0);

    const conditionalResult = await assessNafisReadiness(NAFIS_PRESETS[1]!.input);
    expect(conditionalResult.status).toBe('conditional');
    expect(conditionalResult.quota.tier).toBe('medium_20_49_designated');
    expect(conditionalResult.quota.graceBackfillActive).toBe(true);
    expect(conditionalResult.quota.annualPenaltyAed).toBe(0);
    expect(conditionalResult.quota.potentialAnnualPenaltyAed).toBe(108000);

    const blockedResult = await assessNafisReadiness(NAFIS_PRESETS[2]!.input);
    expect(blockedResult.status).toBe('blocked');
    expect(blockedResult.payrollAudit?.excludedSub6kCount).toBe(2);
    expect(blockedResult.quota.requiredEmiratis).toBe(12);
    expect(blockedResult.quota.activeEligibleEmiratis).toBe(8);
    expect(blockedResult.quota.shortfallSlots).toBe(4);
    expect(blockedResult.quota.monthlyPenaltyAed).toBe(40000);
    expect(blockedResult.quota.annualPenaltyAed).toBe(480000);

    expect(blockedResult.dossierSha256).toMatch(/^[a-f0-9]{64}$/);
    const blockedRepeat = await assessNafisReadiness(NAFIS_PRESETS[2]!.input);
    expect(blockedRepeat.dossierSha256).toBe(blockedResult.dossierSha256);

    expect(readyResult.legalDisclaimerAr).toContain('ليست تابعة');
    expect(readyResult.legalDisclaimerEn).toContain('NOT affiliated');
  });
});
