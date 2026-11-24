export type EstablishmentScope = 'mainland_onshore' | 'freezone_exempt';

export type NafisTier =
  | 'large_50_plus'
  | 'medium_20_49_designated'
  | 'exempt_scope';

export type DesignatedSectorId =
  | 'information_communications'
  | 'financial_insurance'
  | 'real_estate'
  | 'professional_scientific_technical'
  | 'administrative_support_services'
  | 'arts_entertainment'
  | 'mining_quarrying'
  | 'transformative_industries'
  | 'construction'
  | 'wholesale_retail'
  | 'education'
  | 'human_health_social_work'
  | 'transportation_storage'
  | 'hospitality_residency_services';

export type EstablishmentSector = DesignatedSectorId | 'other_non_designated';

export type ReadinessStatus = 'ready' | 'conditional' | 'blocked';

export type SeverityLevel = 'blocker' | 'warning' | 'info';

export type NafisControlId =
  | 'NAF-CTRL-01'
  | 'NAF-CTRL-02'
  | 'NAF-CTRL-03'
  | 'NAF-CTRL-04'
  | 'NAF-CTRL-05'
  | 'NAF-CTRL-06';

export interface DesignatedSectorInfo {
  id: DesignatedSectorId;
  code: number;
  nameAr: string;
  nameEn: string;
}

export interface NafisControlSpec {
  id: NafisControlId;
  weight: number;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface PayrollRowAudit {
  rowNumber: number;
  employeeId: string;
  fullName: string;
  nationalityCode: string;
  roleTier: 'skilled' | 'unskilled';
  monthlySalaryAed: number;
  hireDate: string;
  registeredInWps: boolean;
  registeredInPension: boolean;
  countsTowardQuota: boolean;
  salaryGraceWarning: boolean;
  reasons: string[];
}

export interface PayrollAuditSummary {
  totalRows: number;
  emiratiRows: number;
  eligibleEmiratiCount: number;
  excludedSub6kCount: number;
  graceWarningCount: number;
  missingWpsCount: number;
  missingPensionCount: number;
  nonSkilledEmiratiCount: number;
  rows: PayrollRowAudit[];
  parseErrors: string[];
}

export interface FindingItem {
  code: string;
  severity: SeverityLevel;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  legalRef: string;
}

export interface QuotaEvaluationResult {
  tier: NafisTier;
  targetRatePct: number;
  requiredEmiratis: number;
  activeEligibleEmiratis: number;
  shortfallSlots: number;
  monthlyPenaltyAed: number;
  annualPenaltyAed: number;
  potentialAnnualPenaltyAed: number;
  graceBackfillActive: boolean;
  backfillDaysRemaining: number | null;
  findings: FindingItem[];
}

export interface ControlEvaluationItem {
  id: NafisControlId;
  titleAr: string;
  titleEn: string;
  implemented: boolean;
  weight: number;
}

export interface AssessmentInput {
  establishmentName: string;
  assessmentDate: string;
  scope: EstablishmentScope;
  totalWorkforceCount: number;
  skilledWorkforceCount: number;
  sector: EstablishmentSector;
  activeEligibleEmiratis?: number;
  payrollCsv?: string;
  daysSinceRecentEmiratiResignation?: number | null;
  implementedControls: readonly NafisControlId[];
  notes?: string;
}

export interface AssessmentResult {
  toolName: 'NafisCheck';
  version: string;
  legalDisclaimerAr: string;
  legalDisclaimerEn: string;
  establishmentName: string;
  assessmentDate: string;
  scope: EstablishmentScope;
  status: ReadinessStatus;
  readinessScore: number;
  quota: QuotaEvaluationResult;
  payrollAudit: PayrollAuditSummary | null;
  controls: ControlEvaluationItem[];
  findings: FindingItem[];
  canonicalDossierText: string;
  dossierSha256: string;
}

export interface NafisPreset {
  id: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  input: AssessmentInput;
}
