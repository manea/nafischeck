import {
  canonicalizeDossierPayload,
  computePayloadDigest,
} from './dossierDigest.ts';
import {
  EMIRATI_MIN_SALARY_AED,
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
  NAFIS_CONTROLS,
  NAFIS_TOOL_VERSION,
} from './nafisCatalog.ts';
import { auditEmiratiPayrollCsv } from './payrollCsvAuditor.ts';
import { evaluateNafisQuota } from './quotaEngine.ts';
import type {
  AssessmentInput,
  AssessmentResult,
  ControlEvaluationItem,
  FindingItem,
  NafisControlId,
  PayrollAuditSummary,
  ReadinessStatus,
} from './types.ts';

function buildPayrollFindings(audit: PayrollAuditSummary): FindingItem[] {
  const findings: FindingItem[] = [];

  if (audit.parseErrors.length > 0) {
    findings.push({
      code: 'NAF-CSV-PARSE-ERROR',
      severity: 'blocker',
      titleAr: 'أخطاء في بنية ملف كشف الرواتب CSV',
      titleEn: 'Payroll CSV Validation Errors Detected',
      detailAr: audit.parseErrors.join(' ؛ '),
      detailEn: audit.parseErrors.join('; '),
      legalRef: 'NafisCheck Input Integrity Check',
    });
  }

  if (audit.excludedSub6kCount > 0) {
    findings.push({
      code: 'NAF-SUB6K-EXCLUDED',
      severity: 'blocker',
      titleAr: `استبعاد ${audit.excludedSub6kCount} موظف مواطن بسبب الراتب الأقل من ${EMIRATI_MIN_SALARY_AED.toLocaleString('en-US')} د.إ`,
      titleEn: `${audit.excludedSub6kCount} Emirati(s) Excluded Below AED ${EMIRATI_MIN_SALARY_AED.toLocaleString('en-US')} Salary Floor`,
      detailAr: `الحد الأدنى لأجر المواطن في القطاع الخاص هو ${EMIRATI_MIN_SALARY_AED.toLocaleString('en-US')} د.إ/شهر؛ العقود الأقل تُستبعد من احتساب مستهدف التوطين وتُنشئ عجزاً مالياً محتملاً.`,
      detailEn: `UAE private-sector Emirati minimum salary is AED ${EMIRATI_MIN_SALARY_AED.toLocaleString('en-US')}/month; records below threshold are excluded from quota credit.`,
      legalRef: 'MoHRE AED 6,000 Minimum Emirati Salary Mandate (2026)',
    });
  }

  if (audit.graceWarningCount > 0) {
    findings.push({
      code: 'NAF-SUB6K-GRACE',
      severity: 'warning',
      titleAr: `${audit.graceWarningCount} عقود سابقة تتطلب رفع الراتب إلى ${EMIRATI_MIN_SALARY_AED.toLocaleString('en-US')} د.إ قبل 2026-06-30`,
      titleEn: `${audit.graceWarningCount} Pre-2026 Contract(s) Require Salary Adjustment to AED ${EMIRATI_MIN_SALARY_AED.toLocaleString('en-US')}`,
      detailAr:
        'تنطبق فترة سماح تعديل العقود القديمة حتى 2026-06-30؛ أي تأخر بعد هذا التاريخ يؤدي إلى الاستبعاد الفوري من احتساب نافس.',
      detailEn:
        'Pre-2026 contracts earning under AED 6,000 must be adjusted before 2026-06-30 or lose Nafis quota eligibility.',
      legalRef: 'MoHRE Contract Adjustment Grace Window (H1 2026)',
    });
  }

  if (audit.missingWpsCount > 0) {
    findings.push({
      code: 'NAF-WPS-MISSING',
      severity: 'blocker',
      titleAr: `${audit.missingWpsCount} سجل/سجلات مواطنين غير مسجلة في نظام حماية الأجور (WPS)`,
      titleEn: `${audit.missingWpsCount} Emirati Payroll Record(s) Missing WPS Routing`,
      detailAr:
        'عدم تحويل راتب المواطن عبر نظام حماية الأجور يفقده الأهلية للاحتساب ضمن نسبة التوطين.',
      detailEn:
        'Salaries not disbursed through MoHRE WPS are disqualified from Emiratisation quota recognition.',
      legalRef: 'MoHRE Wage Protection System Compliance',
    });
  }

  if (audit.missingPensionCount > 0) {
    findings.push({
      code: 'NAF-PENSION-MISSING',
      severity: 'blocker',
      titleAr: `${audit.missingPensionCount} سجل/سجلات بدون تسجيل في صندوق التقاعد (GPSSA / ADPF)`,
      titleEn: `${audit.missingPensionCount} Emirati Record(s) Missing GPSSA / ADPF Pension Enrollment`,
      detailAr:
        'يلزم تسجيل المواطن في الهيئة العامة للمعاشات أو صندوق أبوظبي للمعاشات وتفعيل الاشتراكات للاحتساب.',
      detailEn:
        'Active pension registration with GPSSA or ADPF is mandatory for quota recognition.',
      legalRef: 'UAE Pension & Social Security Enrollment Mandate',
    });
  }

  if (audit.nonSkilledEmiratiCount > 0) {
    findings.push({
      code: 'NAF-UNSKILLED-ROLE',
      severity: 'warning',
      titleAr: `${audit.nonSkilledEmiratiCount} سجل/سجلات مصنفة كوظائف غير مهارية`,
      titleEn: `${audit.nonSkilledEmiratiCount} Emirati Record(s) Marked Non-Skilled`,
      detailAr:
        'مستهدفات الـ 50+ تتطلب وظائف مهارية مصنفة في المستويات 1–5 وفق ISCO.',
      detailEn:
        'The 50+ Emiratisation targets strictly count ISCO Levels 1–5 skilled roles.',
      legalRef: 'MoHRE Skilled Labour Classification (ISCO Levels 1–5)',
    });
  }

  return findings;
}

export async function assessNafisReadiness(
  input: AssessmentInput,
): Promise<AssessmentResult> {
  const hasPayrollCsv =
    typeof input.payrollCsv === 'string' && input.payrollCsv.trim().length > 0;
  const payrollAudit = hasPayrollCsv
    ? auditEmiratiPayrollCsv(input.payrollCsv!, input.assessmentDate)
    : null;

  const resolvedEligibleEmiratis = payrollAudit
    ? payrollAudit.eligibleEmiratiCount
    : (input.activeEligibleEmiratis ?? 0);

  const quota = evaluateNafisQuota(input, resolvedEligibleEmiratis);
  const payrollFindings = payrollAudit ? buildPayrollFindings(payrollAudit) : [];
  const findings: FindingItem[] = [...quota.findings, ...payrollFindings];

  const implementedSet: ReadonlySet<NafisControlId> = new Set(
    input.implementedControls,
  );
  const controls: ControlEvaluationItem[] = NAFIS_CONTROLS.map((ctrl) => ({
    id: ctrl.id,
    titleAr: ctrl.titleAr,
    titleEn: ctrl.titleEn,
    implemented: implementedSet.has(ctrl.id),
    weight: ctrl.weight,
  }));

  const missingControlCount = controls.filter((c) => !c.implemented).length;
  const controlScore = controls.reduce(
    (sum, item) => sum + (item.implemented ? item.weight : 0),
    0,
  );

  const hasBlocker = findings.some((f) => f.severity === 'blocker');
  const hasWarning = findings.some((f) => f.severity === 'warning');

  let status: ReadinessStatus;
  if (hasBlocker || (quota.shortfallSlots > 0 && !quota.graceBackfillActive)) {
    status = 'blocked';
  } else if (hasWarning || quota.graceBackfillActive || missingControlCount > 0) {
    status = 'conditional';
  } else {
    status = 'ready';
  }

  let readinessScore = controlScore;
  if (quota.shortfallSlots > 0 && !quota.graceBackfillActive) {
    readinessScore -= Math.min(55, quota.shortfallSlots * 15);
  }
  if (payrollAudit && payrollAudit.excludedSub6kCount > 0) {
    readinessScore -= Math.min(20, payrollAudit.excludedSub6kCount * 5);
  }
  readinessScore = Math.max(0, Math.min(100, readinessScore));
  if (status === 'blocked') {
    readinessScore = Math.min(readinessScore, 55);
  } else if (status === 'conditional') {
    readinessScore = Math.min(readinessScore, 88);
  }

  const digestInput = {
    version: NAFIS_TOOL_VERSION,
    establishmentName: input.establishmentName,
    assessmentDate: input.assessmentDate,
    scope: input.scope,
    sector: input.sector,
    totalWorkforceCount: input.totalWorkforceCount,
    skilledWorkforceCount: input.skilledWorkforceCount,
    status,
    readinessScore,
    quota: {
      tier: quota.tier,
      targetRatePct: quota.targetRatePct,
      requiredEmiratis: quota.requiredEmiratis,
      activeEligibleEmiratis: quota.activeEligibleEmiratis,
      shortfallSlots: quota.shortfallSlots,
      annualPenaltyAed: quota.annualPenaltyAed,
      graceBackfillActive: quota.graceBackfillActive,
    },
    implementedControls: [...implementedSet].sort(),
  };

  const canonicalDossierText = canonicalizeDossierPayload(digestInput);
  const dossierSha256 = await computePayloadDigest(canonicalDossierText);

  return {
    toolName: 'NafisCheck',
    version: NAFIS_TOOL_VERSION,
    legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
    legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
    establishmentName: input.establishmentName,
    assessmentDate: input.assessmentDate,
    scope: input.scope,
    status,
    readinessScore,
    quota,
    payrollAudit,
    controls,
    findings,
    canonicalDossierText,
    dossierSha256,
  };
}
