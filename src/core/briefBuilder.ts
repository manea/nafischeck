import type { AssessmentInput, AssessmentResult } from './types.ts';

export function buildNafisBriefMarkdown(
  input: AssessmentInput,
  result: AssessmentResult,
  dossierCode = 'DRAFT',
  sha256Digest = result.dossierSha256,
  locale: 'en' | 'ar' = 'ar',
): string {
  const digest = sha256Digest || result.dossierSha256;
  const q = result.quota;
  const implemented = result.controls.filter((c) => c.implemented).map((c) => c.id);
  const missing = result.controls.filter((c) => !c.implemented).map((c) => c.id);

  if (locale === 'ar') {
    const lines: string[] = [
      `# ملف جاهزية التوطين الإماراتي ونافس (NafisCheck) — ${dossierCode}`,
      '',
      `> **تنويه قانوني إلزامي**: ${result.legalDisclaimerAr}`,
      '',
      `- **المنشأة**: ${result.establishmentName}`,
      `- **النطاق التنظيمي**: \`${result.scope}\` · **القطاع**: \`${input.sector}\``,
      `- **تاريخ التقييم**: ${result.assessmentDate}`,
      `- **حالة الجاهزية الإجمالية**: \`${result.status.toUpperCase()}\` (${result.readinessScore}/100)`,
      `- **بصمة SHA-256 المعيارية**: \`${digest}\``,
      '',
      '## 1. حساب نصاب التوطين والغرامات المتوقعة',
      `- الفئة التنظيمية: \`${q.tier}\` · النسبة المستهدفة نصف السنوية: ${q.targetRatePct}%`,
      `- المطلوب توظيفهم: ${q.requiredEmiratis} · المؤهلون الفعليون: ${q.activeEligibleEmiratis} · العجز: ${q.shortfallSlots}`,
      `- الغرامة الشهرية الحالية: AED ${q.monthlyPenaltyAed.toLocaleString('en-US')} · السنوية: AED ${q.annualPenaltyAed.toLocaleString('en-US')}`,
      `- مهلة الاستبدال (60 يوماً) سارية؟ ${q.graceBackfillActive ? `نعم (متبقٍ ${q.backfillDaysRemaining ?? 0} يوماً · تعرض محتمل AED ${q.potentialAnnualPenaltyAed.toLocaleString('en-US')}/سنة)` : 'لا'}`,
      '',
    ];

    if (result.payrollAudit) {
      const a = result.payrollAudit;
      lines.push(
        '## 2. تدقيق كشف الرواتب CSV والحد الأدنى (AED 6,000)',
        `- إجمالي الصفوف: ${a.totalRows} · سجلات المواطنين: ${a.emiratiRows} · المؤهلون للاحتساب: ${a.eligibleEmiratiCount}`,
        `- مستبعدون (< 6,000 د.إ): ${a.excludedSub6kCount} · تنبيه مهلة تعديل العقود: ${a.graceWarningCount}`,
        `- بدون WPS: ${a.missingWpsCount} · بدون صندوق التقاعد (GPSSA/ADPF): ${a.missingPensionCount} · غير مهارية: ${a.nonSkilledEmiratiCount}`,
        '',
      );
    }

    lines.push(
      '## 3. الضوابط التشغيلية الستة (MoHRE / Nafis)',
      `- المستوفاة (${implemented.length}/6): ${implemented.length > 0 ? implemented.join(', ') : 'لا يوجد'}`,
      `- الناقصة (${missing.length}/6): ${missing.length > 0 ? missing.join(', ') : 'لا يوجد'}`,
      '',
      '## 4. النتائج والملاحظات',
      ...result.findings.map(
        (f) => `- [${f.severity.toUpperCase()} · ${f.code} · ${f.legalRef}] ${f.titleAr}: ${f.detailAr}`,
      ),
    );

    if (input.notes?.trim()) {
      lines.push('', '## 5. ملاحظات تشغيلية مرفقة', input.notes.trim());
    }
    return `${lines.join('\n')}\n`;
  }

  const lines: string[] = [
    `# UAE MoHRE / Nafis Emiratisation Readiness Dossier (NafisCheck) — ${dossierCode}`,
    '',
    `> **Mandatory Disclaimer**: ${result.legalDisclaimerEn}`,
    '',
    `- **Establishment**: ${result.establishmentName}`,
    `- **Regulatory Scope**: \`${result.scope}\` · **Sector**: \`${input.sector}\``,
    `- **Assessment Date**: ${result.assessmentDate}`,
    `- **Overall Readiness**: \`${result.status.toUpperCase()}\` (${result.readinessScore}/100)`,
    `- **Canonical SHA-256 Digest**: \`${digest}\``,
    '',
    '## 1. Emiratisation Quota & Penalty Breakdown',
    `- Applicable Tier: \`${q.tier}\` · Semi-Annual Skilled Target: ${q.targetRatePct}%`,
    `- Required Emiratis: ${q.requiredEmiratis} · Active Eligible: ${q.activeEligibleEmiratis} · Shortfall Slots: ${q.shortfallSlots}`,
    `- Monthly Exposure: AED ${q.monthlyPenaltyAed.toLocaleString('en-US')} · Annual Exposure: AED ${q.annualPenaltyAed.toLocaleString('en-US')}`,
    `- 60-Day Replacement Grace Active?: ${q.graceBackfillActive ? `YES (${q.backfillDaysRemaining ?? 0} days left · potential AED ${q.potentialAnnualPenaltyAed.toLocaleString('en-US')}/yr)` : 'NO'}`,
    '',
  ];

  if (result.payrollAudit) {
    const a = result.payrollAudit;
    lines.push(
      '## 2. Emirati Payroll CSV Audit (AED 6,000 Floor, WPS & Pension)',
      `- Total Rows: ${a.totalRows} · Emirati Rows: ${a.emiratiRows} · Eligible Count: ${a.eligibleEmiratiCount}`,
      `- Excluded (< AED 6,000): ${a.excludedSub6kCount} · Pre-2026 Grace Warnings: ${a.graceWarningCount}`,
      `- Missing WPS: ${a.missingWpsCount} · Missing GPSSA/ADPF Pension: ${a.missingPensionCount} · Non-Skilled Roles: ${a.nonSkilledEmiratiCount}`,
      '',
    );
  }

  lines.push(
    '## 3. Six MoHRE / Nafis Operational Controls',
    `- Implemented (${implemented.length}/6): ${implemented.length > 0 ? implemented.join(', ') : 'None'}`,
    `- Missing (${missing.length}/6): ${missing.length > 0 ? missing.join(', ') : 'None'}`,
    '',
    '## 4. Compliance Findings',
    ...result.findings.map(
      (f) => `- [${f.severity.toUpperCase()} · ${f.code} · ${f.legalRef}] ${f.titleEn}: ${f.detailEn}`,
    ),
  );

  if (input.notes?.trim()) {
    lines.push('', '## 5. Attached Notes', input.notes.trim());
  }
  return `${lines.join('\n')}\n`;
}
