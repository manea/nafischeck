import {
  EMIRATI_MIN_SALARY_AED,
  MIN_SALARY_EFFECTIVE_DATE,
  MIN_SALARY_GRACE_END_DATE,
} from './nafisCatalog.ts';
import type { PayrollAuditSummary, PayrollRowAudit } from './types.ts';

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseBooleanCell(raw: string | undefined): boolean {
  if (!raw) return false;
  const val = raw.trim().toLowerCase();
  return (
    val === 'true' ||
    val === '1' ||
    val === 'yes' ||
    val === 'y' ||
    val === 'نعم'
  );
}

function isEmiratiNationality(raw: string | undefined): boolean {
  if (!raw) return false;
  const val = raw.trim().toUpperCase();
  return (
    val === 'AE' ||
    val === 'UAE' ||
    val === 'ARE' ||
    val === 'EMIRATI' ||
    val === 'إماراتي' ||
    val === 'اماراتي'
  );
}

function normalizeRoleTier(raw: string | undefined): 'skilled' | 'unskilled' {
  const val = (raw ?? '').trim().toLowerCase();
  return val === 'skilled' || val === 'مهاري' || val === 'مهارية'
    ? 'skilled'
    : 'unskilled';
}

/**
 * Neutralizes CWE-1236 spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`)
 * and wraps fields containing commas, quotes, or newlines per RFC 4180.
 */
export function sanitizeCsvCell(value: string | number | boolean): string {
  const raw = String(value);
  const needsFormulaGuard = /^[=+\-@\t\r]/.test(raw);
  const safe = needsFormulaGuard ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function auditEmiratiPayrollCsv(
  csvText: string,
  assessmentDate: string,
): PayrollAuditSummary {
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return {
      totalRows: 0,
      emiratiRows: 0,
      eligibleEmiratiCount: 0,
      excludedSub6kCount: 0,
      graceWarningCount: 0,
      missingWpsCount: 0,
      missingPensionCount: 0,
      nonSkilledEmiratiCount: 0,
      rows: [],
      parseErrors: ['CSV payload is empty.'],
    };
  }

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      totalRows: 0,
      emiratiRows: 0,
      eligibleEmiratiCount: 0,
      excludedSub6kCount: 0,
      graceWarningCount: 0,
      missingWpsCount: 0,
      missingPensionCount: 0,
      nonSkilledEmiratiCount: 0,
      rows: [],
      parseErrors: ['CSV must include a header row and at least one employee row.'],
    };
  }

  const headers = parseCsvLine(lines[0]!).map((h) => h.toLowerCase().trim());
  const colIndex = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headers.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxId = colIndex(['employee_id', 'id', 'emp_id']);
  const idxName = colIndex(['full_name', 'name', 'employee_name']);
  const idxNat = colIndex(['nationality', 'nationality_code', 'country']);
  const idxRole = colIndex(['role_tier', 'skill_level', 'tier']);
  const idxSalary = colIndex(['monthly_salary_aed', 'salary_aed', 'salary']);
  const idxHireDate = colIndex(['hire_date', 'start_date', 'joined_at']);
  const idxWps = colIndex(['registered_in_wps', 'wps', 'wps_active']);
  const idxPension = colIndex([
    'registered_in_pension',
    'pension',
    'gpssa_adpf',
  ]);

  const parseErrors: string[] = [];
  if (idxNat === -1 || idxSalary === -1) {
    parseErrors.push(
      'Missing required CSV columns: nationality and monthly_salary_aed.',
    );
    return {
      totalRows: lines.length - 1,
      emiratiRows: 0,
      eligibleEmiratiCount: 0,
      excludedSub6kCount: 0,
      graceWarningCount: 0,
      missingWpsCount: 0,
      missingPensionCount: 0,
      nonSkilledEmiratiCount: 0,
      rows: [],
      parseErrors,
    };
  }

  const rows: PayrollRowAudit[] = [];
  let emiratiRows = 0;
  let eligibleEmiratiCount = 0;
  let excludedSub6kCount = 0;
  let graceWarningCount = 0;
  let missingWpsCount = 0;
  let missingPensionCount = 0;
  let nonSkilledEmiratiCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]!);
    const rowNumber = i + 1;
    const nationalityRaw = cells[idxNat] ?? '';
    if (!isEmiratiNationality(nationalityRaw)) {
      continue;
    }

    emiratiRows += 1;
    const employeeId = (idxId !== -1 ? cells[idxId] : '') || `EMP-${rowNumber}`;
    const fullName =
      (idxName !== -1 ? cells[idxName] : '') || `Emirati Employee ${rowNumber}`;
    const roleTier = normalizeRoleTier(
      idxRole !== -1 ? cells[idxRole] : 'skilled',
    );
    const salaryRaw = cells[idxSalary] ?? '0';
    const monthlySalaryAed = Number(salaryRaw.replace(/,/g, ''));
    const hireDate =
      (idxHireDate !== -1 ? cells[idxHireDate] : '') || MIN_SALARY_EFFECTIVE_DATE;
    const registeredInWps =
      idxWps !== -1 ? parseBooleanCell(cells[idxWps]) : false;
    const registeredInPension =
      idxPension !== -1 ? parseBooleanCell(cells[idxPension]) : false;

    const reasons: string[] = [];
    let countsTowardQuota = true;
    let salaryGraceWarning = false;

    if (!Number.isFinite(monthlySalaryAed) || monthlySalaryAed < 0) {
      countsTowardQuota = false;
      parseErrors.push(`Row ${rowNumber}: invalid numeric salary "${salaryRaw}".`);
      reasons.push('Invalid salary number');
    } else if (monthlySalaryAed < EMIRATI_MIN_SALARY_AED) {
      const inPre2026ContractGraceWindow =
        assessmentDate >= MIN_SALARY_EFFECTIVE_DATE &&
        assessmentDate <= MIN_SALARY_GRACE_END_DATE &&
        hireDate < MIN_SALARY_EFFECTIVE_DATE;

      if (inPre2026ContractGraceWindow) {
        salaryGraceWarning = true;
        graceWarningCount += 1;
        reasons.push(
          `Salary AED ${monthlySalaryAed} below AED ${EMIRATI_MIN_SALARY_AED}; existing pre-2026 contract must be adjusted before ${MIN_SALARY_GRACE_END_DATE}`,
        );
      } else {
        countsTowardQuota = false;
        excludedSub6kCount += 1;
        reasons.push(
          `Salary AED ${monthlySalaryAed} is below MoHRE AED ${EMIRATI_MIN_SALARY_AED}/mo minimum threshold (excluded from Nafis quota)`,
        );
      }
    }

    if (!registeredInWps) {
      countsTowardQuota = false;
      missingWpsCount += 1;
      reasons.push('Not routed through Wage Protection System (WPS)');
    }

    if (!registeredInPension) {
      countsTowardQuota = false;
      missingPensionCount += 1;
      reasons.push('Missing GPSSA / ADPF pension registration');
    }

    if (roleTier !== 'skilled') {
      countsTowardQuota = false;
      nonSkilledEmiratiCount += 1;
      reasons.push('Role tier is not classified as skilled (ISCO Levels 1–5)');
    }

    if (countsTowardQuota) {
      eligibleEmiratiCount += 1;
    }

    rows.push({
      rowNumber,
      employeeId,
      fullName,
      nationalityCode: 'AE',
      roleTier,
      monthlySalaryAed: Number.isFinite(monthlySalaryAed) ? monthlySalaryAed : 0,
      hireDate,
      registeredInWps,
      registeredInPension,
      countsTowardQuota,
      salaryGraceWarning,
      reasons,
    });
  }

  return {
    totalRows: lines.length - 1,
    emiratiRows,
    eligibleEmiratiCount,
    excludedSub6kCount,
    graceWarningCount,
    missingWpsCount,
    missingPensionCount,
    nonSkilledEmiratiCount,
    rows,
    parseErrors,
  };
}

export function exportPayrollAuditCsv(summary: PayrollAuditSummary): string {
  const header = [
    'row_number',
    'employee_id',
    'full_name',
    'nationality',
    'role_tier',
    'monthly_salary_aed',
    'hire_date',
    'registered_in_wps',
    'registered_in_pension',
    'counts_toward_quota',
    'salary_grace_warning',
    'audit_notes',
  ].join(',');

  const lines = summary.rows.map((row) =>
    [
      sanitizeCsvCell(row.rowNumber),
      sanitizeCsvCell(row.employeeId),
      sanitizeCsvCell(row.fullName),
      sanitizeCsvCell(row.nationalityCode),
      sanitizeCsvCell(row.roleTier),
      sanitizeCsvCell(row.monthlySalaryAed),
      sanitizeCsvCell(row.hireDate),
      sanitizeCsvCell(row.registeredInWps),
      sanitizeCsvCell(row.registeredInPension),
      sanitizeCsvCell(row.countsTowardQuota),
      sanitizeCsvCell(row.salaryGraceWarning),
      sanitizeCsvCell(row.reasons.join(' | ')),
    ].join(','),
  );

  return `\uFEFF${[header, ...lines].join('\n')}\n`;
}
