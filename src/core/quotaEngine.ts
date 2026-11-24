import {
  BACKFILL_GRACE_DAYS,
  DESIGNATED_SECTOR_IDS,
} from './nafisCatalog.ts';
import type {
  AssessmentInput,
  EstablishmentSector,
  FindingItem,
  QuotaEvaluationResult,
} from './types.ts';

function isValidSector(sector: EstablishmentSector): boolean {
  return sector !== 'other_non_designated' && DESIGNATED_SECTOR_IDS.has(sector);
}

/**
 * Computes MoHRE's semi-annual skilled Emiratisation target percentage for 50+ mainland firms.
 * Progression: +1% every H1 (by June 30) and +1% every H2 (by December 31),
 * rising from 2% baseline (end-2022) to 9% on 2026-06-30 and 10% on 2026-12-31.
 */
export function getSemiAnnualTargetPct(assessmentDate: string): number {
  const cleanDate = assessmentDate.trim();
  if (cleanDate <= '2022-12-31') return 2;
  if (cleanDate <= '2023-06-30') return 3;
  if (cleanDate <= '2023-12-31') return 4;
  if (cleanDate <= '2024-06-30') return 5;
  if (cleanDate <= '2024-12-31') return 6;
  if (cleanDate <= '2025-06-30') return 7;
  if (cleanDate <= '2025-12-31') return 8;
  if (cleanDate <= '2026-06-30') return 9;
  return 10;
}

/**
 * Returns the monthly MoHRE financial contribution per missing Emirati slot for 50+ firms:
 * AED 7,000 (2023), AED 8,000 (2024), AED 9,000 (2025), AED 10,000 (2026+).
 */
export function getMonthlySlotPenaltyAed(assessmentDate: string): number {
  const year = Number(assessmentDate.slice(0, 4)) || 2026;
  if (year <= 2022) return 6000;
  if (year === 2023) return 7000;
  if (year === 2024) return 8000;
  if (year === 2025) return 9000;
  return 10000;
}

export function evaluateNafisQuota(
  input: AssessmentInput,
  resolvedActiveEligibleEmiratis: number,
): QuotaEvaluationResult {
  const findings: FindingItem[] = [];
  const activeEligibleEmiratis = Math.max(
    0,
    Math.floor(resolvedActiveEligibleEmiratis),
  );
  const totalWorkforce = Math.max(0, Math.floor(input.totalWorkforceCount));
  const skilledWorkforce = Math.max(0, Math.floor(input.skilledWorkforceCount));
  const year = Number(input.assessmentDate.slice(0, 4)) || 2026;

  if (input.scope === 'freezone_exempt') {
    findings.push({
      code: 'NAF-FREEZONE-EXEMPT',
      severity: 'info',
      titleAr: 'منشأة في منطقة حرة معفاة من حصص نافس الاتحادية',
      titleEn: 'Free Zone Establishment Exempt from Federal MoHRE Nafis Quotas',
      detailAr:
        'تُعفى المنشآت العاملة حصراً داخل المناطق الحرة (مثل DIFC وADGM وDMCC) من مستهدفات التوطين الإلزامية لوزارة الموارد البشرية والتوطين ما لم توظف عمالة في البر الرئيسي.',
      detailEn:
        'Entities operating exclusively in UAE free zones are exempt from onshore MoHRE Emiratisation mandates unless sponsoring mainland staff.',
      legalRef: 'UAE Cabinet Resolution No. 18 of 2022 / MoHRE Scope',
    });

    return {
      tier: 'exempt_scope',
      targetRatePct: 0,
      requiredEmiratis: 0,
      activeEligibleEmiratis,
      shortfallSlots: 0,
      monthlyPenaltyAed: 0,
      annualPenaltyAed: 0,
      potentialAnnualPenaltyAed: 0,
      graceBackfillActive: false,
      backfillDaysRemaining: null,
      findings,
    };
  }

  // Tier 1: Mainland 50+ skilled workers (takes precedence when skilled >= 50)
  if (skilledWorkforce >= 50) {
    const targetRatePct = getSemiAnnualTargetPct(input.assessmentDate);
    const requiredEmiratis = Math.ceil(
      (skilledWorkforce * targetRatePct) / 100,
    );
    const rawShortfall = Math.max(0, requiredEmiratis - activeEligibleEmiratis);
    const monthlyRate = getMonthlySlotPenaltyAed(input.assessmentDate);
    const potentialAnnualPenaltyAed = rawShortfall * monthlyRate * 12;

    const daysSinceDeparture = input.daysSinceRecentEmiratiResignation;
    const graceBackfillActive =
      rawShortfall > 0 &&
      typeof daysSinceDeparture === 'number' &&
      Number.isFinite(daysSinceDeparture) &&
      daysSinceDeparture >= 0 &&
      daysSinceDeparture <= BACKFILL_GRACE_DAYS;

    const backfillDaysRemaining = graceBackfillActive
      ? BACKFILL_GRACE_DAYS - Math.floor(daysSinceDeparture!)
      : null;

    if (rawShortfall === 0) {
      findings.push({
        code: 'NAF-50PLUS-COMPLIANT',
        severity: 'info',
        titleAr: `مستهدف التوطين للمنشآت 50+ مكتمل (${targetRatePct}%)`,
        titleEn: `50+ Skilled Workforce Quota Satisfied (${targetRatePct}%)`,
        detailAr: `المطلوب ${requiredEmiratis} مواطن/مواطنة من أصل ${skilledWorkforce} وظيفة مهارية (${targetRatePct}%)، والمسجل المؤهل حالياً ${activeEligibleEmiratis}.`,
        detailEn: `Required ${requiredEmiratis} Emiratis for ${skilledWorkforce} skilled roles (${targetRatePct}%); ${activeEligibleEmiratis} active eligible Emiratis verified.`,
        legalRef: 'Cabinet Resolutions No. 18 & 45 of 2022 (10% by end-2026)',
      });

      return {
        tier: 'large_50_plus',
        targetRatePct,
        requiredEmiratis,
        activeEligibleEmiratis,
        shortfallSlots: 0,
        monthlyPenaltyAed: 0,
        annualPenaltyAed: 0,
        potentialAnnualPenaltyAed: 0,
        graceBackfillActive: false,
        backfillDaysRemaining: null,
        findings,
      };
    }

    if (graceBackfillActive) {
      findings.push({
        code: 'NAF-BACKFILL-GRACE',
        severity: 'warning',
        titleAr: `فجوة توطين داخل مهلة الاستبدال (${backfillDaysRemaining} يوماً متبقياً)`,
        titleEn: `Shortfall Within 60-Day Backfill Grace (${backfillDaysRemaining} Days Left)`,
        detailAr: `يوجد نقص بمقدار ${rawShortfall} موظف مواطن ولكن المنشأة ما زالت ضمن مهلة الـ 60 يوماً منذ انتهاء الخدمة. يجب استكمال التوظيف قبل انقضاء المهلة لتجنب مساهمة قدرها ${potentialAnnualPenaltyAed.toLocaleString('en-US')} د.إ/سنة.`,
        detailEn: `Shortfall of ${rawShortfall} slot(s) currently falls within the 60-day MoHRE replacement grace period (${backfillDaysRemaining} days remaining). Completing backfill avoids AED ${potentialAnnualPenaltyAed.toLocaleString('en-US')}/year financial contribution.`,
        legalRef: 'MoHRE 60-Day Emirati Replacement Grace Rule',
      });

      return {
        tier: 'large_50_plus',
        targetRatePct,
        requiredEmiratis,
        activeEligibleEmiratis,
        shortfallSlots: rawShortfall,
        monthlyPenaltyAed: 0,
        annualPenaltyAed: 0,
        potentialAnnualPenaltyAed,
        graceBackfillActive: true,
        backfillDaysRemaining,
        findings,
      };
    }

    const monthlyPenaltyAed = rawShortfall * monthlyRate;
    const annualPenaltyAed = monthlyPenaltyAed * 12;

    findings.push({
      code: 'NAF-QUOTA-SHORTFALL',
      severity: 'blocker',
      titleAr: `عجز في مستهدف التوطين للمنشآت 50+: ${rawShortfall} شواغر`,
      titleEn: `50+ Emiratisation Quota Shortfall: ${rawShortfall} Slot(s)`,
      detailAr: `بنسبة ${targetRatePct}% على ${skilledWorkforce} وظيفة مهارية يلزم توظيف ${requiredEmiratis} مواطناً (المؤهل فعلياً ${activeEligibleEmiratis}). الغرامة المقدرة: ${monthlyPenaltyAed.toLocaleString('en-US')} د.إ/شهر (${annualPenaltyAed.toLocaleString('en-US')} د.إ/سنة).`,
      detailEn: `At ${targetRatePct}% across ${skilledWorkforce} skilled roles, ${requiredEmiratis} Emiratis are required (${activeEligibleEmiratis} eligible). Estimated fine: AED ${monthlyPenaltyAed.toLocaleString('en-US')}/month (AED ${annualPenaltyAed.toLocaleString('en-US')}/year).`,
      legalRef: 'Cabinet Resolutions No. 18 & 45 of 2022 / 2026 Fine Schedule',
    });

    return {
      tier: 'large_50_plus',
      targetRatePct,
      requiredEmiratis,
      activeEligibleEmiratis,
      shortfallSlots: rawShortfall,
      monthlyPenaltyAed,
      annualPenaltyAed,
      potentialAnnualPenaltyAed: annualPenaltyAed,
      graceBackfillActive: false,
      backfillDaysRemaining: null,
      findings,
    };
  }

  // Tier 2: Mainland 20-49 in 14 designated sectors
  if (
    totalWorkforce >= 20 &&
    totalWorkforce <= 49 &&
    isValidSector(input.sector)
  ) {
    const requiredEmiratis = year >= 2025 ? 2 : 1;
    const annualFineBase = year >= 2025 ? 108000 : 96000;
    const rawShortfall = Math.max(0, requiredEmiratis - activeEligibleEmiratis);
    const daysSinceDeparture = input.daysSinceRecentEmiratiResignation;
    const graceBackfillActive =
      rawShortfall > 0 &&
      typeof daysSinceDeparture === 'number' &&
      Number.isFinite(daysSinceDeparture) &&
      daysSinceDeparture >= 0 &&
      daysSinceDeparture <= BACKFILL_GRACE_DAYS;

    const backfillDaysRemaining = graceBackfillActive
      ? BACKFILL_GRACE_DAYS - Math.floor(daysSinceDeparture!)
      : null;

    if (rawShortfall === 0) {
      findings.push({
        code: 'NAF-20TO49-COMPLIANT',
        severity: 'info',
        titleAr: `مستهدف المنشآت 20–49 مكتمل (${requiredEmiratis} مواطنين)`,
        titleEn: `20–49 Designated-Sector Target Satisfied (${requiredEmiratis} Citizens)`,
        detailAr: `المنشأة ضمن القطاعات الـ 14 المحددة وتوظف ${activeEligibleEmiratis} مواطن/مواطنة مؤهلين (المطلوب ${requiredEmiratis}).`,
        detailEn: `Establishment operates in one of the 14 targeted sectors with ${activeEligibleEmiratis} eligible Emiratis (required ${requiredEmiratis}).`,
        legalRef: 'UAE Cabinet Resolution No. 95 of 2023 (20–49 Expansion)',
      });

      return {
        tier: 'medium_20_49_designated',
        targetRatePct: 0,
        requiredEmiratis,
        activeEligibleEmiratis,
        shortfallSlots: 0,
        monthlyPenaltyAed: 0,
        annualPenaltyAed: 0,
        potentialAnnualPenaltyAed: 0,
        graceBackfillActive: false,
        backfillDaysRemaining: null,
        findings,
      };
    }

    if (graceBackfillActive) {
      findings.push({
        code: 'NAF-BACKFILL-GRACE',
        severity: 'warning',
        titleAr: `مهلة الـ 60 يوماً سارية لاستبدال المواطن في فئة 20–49 (${backfillDaysRemaining} يوماً متبقياً)`,
        titleEn: `20–49 Sector Backfill Within 60-Day Grace (${backfillDaysRemaining} Days Left)`,
        detailAr: `توجد فجوة بمقدار ${rawShortfall} مواطن في منشأة ضمن القطاعات الـ 14، لكنها ضمن مهلة الـ 60 يوماً. تجاوز المهلة يفرض مساهمة سنوية قدرها ${annualFineBase.toLocaleString('en-US')} د.إ.`,
        detailEn: `Shortfall of ${rawShortfall} Emirati slot(s) in a 20–49 designated sector is within the 60-day backfill grace window. Missing the deadline triggers AED ${annualFineBase.toLocaleString('en-US')}/year fine.`,
        legalRef: 'Cabinet Resolution No. 95 of 2023 / 60-Day Replacement Rule',
      });

      return {
        tier: 'medium_20_49_designated',
        targetRatePct: 0,
        requiredEmiratis,
        activeEligibleEmiratis,
        shortfallSlots: rawShortfall,
        monthlyPenaltyAed: 0,
        annualPenaltyAed: 0,
        potentialAnnualPenaltyAed: annualFineBase,
        graceBackfillActive: true,
        backfillDaysRemaining,
        findings,
      };
    }

    const monthlyPenaltyAed = Math.round(annualFineBase / 12);
    findings.push({
      code: 'NAF-QUOTA-SHORTFALL',
      severity: 'blocker',
      titleAr: `عدم استيفاء مستهدف القطاعات الـ 14 للمنشآت 20–49`,
      titleEn: `20–49 Designated-Sector Emiratisation Shortfall`,
      detailAr: `يلزم توظيف ${requiredEmiratis} مواطن/مواطنة في هذا القطاع للمنشآت بين 20 و49 موظفاً (المتاح المؤهل: ${activeEligibleEmiratis}). المساهمة السنوية المطبقة: ${annualFineBase.toLocaleString('en-US')} د.إ/سنة.`,
      detailEn: `Designated 20–49 firms require ${requiredEmiratis} Emiratis (${activeEligibleEmiratis} eligible). Statutory non-compliance contribution: AED ${annualFineBase.toLocaleString('en-US')}/year.`,
      legalRef: 'UAE Cabinet Resolution No. 95 of 2023',
    });

    return {
      tier: 'medium_20_49_designated',
      targetRatePct: 0,
      requiredEmiratis,
      activeEligibleEmiratis,
      shortfallSlots: rawShortfall,
      monthlyPenaltyAed,
      annualPenaltyAed: annualFineBase,
      potentialAnnualPenaltyAed: annualFineBase,
      graceBackfillActive: false,
      backfillDaysRemaining: null,
      findings,
    };
  }

  // Below threshold (< 20 total staff, or 20-49 outside the 14 sectors with < 50 skilled)
  findings.push({
    code: 'NAF-BELOW-MANDATE-THRESHOLD',
    severity: 'info',
    titleAr: 'المنشأة دون حد الإلزام العددي للتوطين أو خارج القطاعات الـ 14',
    titleEn: 'Below Mandatory Emiratisation Threshold or Non-Designated 20–49 Sector',
    detailAr:
      'لا تخضع المنشآت بأقل من 20 موظفاً (أو 20–49 خارج القطاعات الـ 14 مع أقل من 50 وظيفة مهارية) لحصص إلزامية حالياً، مع التوصية بمتابعة النمو لتفادي الدخول المفاجئ للنصاب.',
    detailEn:
      'Establishments under 20 staff (or 20–49 outside the 14 designated sectors with < 50 skilled roles) carry no current mandatory quota; monitor hiring growth closely.',
    legalRef: 'MoHRE Emiratisation Threshold Rules',
  });

  return {
    tier: 'exempt_scope',
    targetRatePct: 0,
    requiredEmiratis: 0,
    activeEligibleEmiratis,
    shortfallSlots: 0,
    monthlyPenaltyAed: 0,
    annualPenaltyAed: 0,
    potentialAnnualPenaltyAed: 0,
    graceBackfillActive: false,
    backfillDaysRemaining: null,
    findings,
  };
}
