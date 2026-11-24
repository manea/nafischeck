import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BACKFILL_GRACE_DAYS,
  DESIGNATED_14_SECTORS,
  DESIGNATED_SECTOR_IDS,
  EMIRATI_MIN_SALARY_AED,
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
  MIN_SALARY_EFFECTIVE_DATE,
  MIN_SALARY_GRACE_END_DATE,
  NAFIS_CONTROLS,
  NAFIS_PRESETS,
  assessNafisReadiness,
  auditEmiratiPayrollCsv,
  buildNafisBriefMarkdown,
  evaluateNafisQuota,
  exportPayrollAuditCsv,
  sanitizeCsvCell,
} from '../src/core/index.ts';
import { openNafisDatabase, slugify } from './db.mjs';

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
let APP_VERSION = '0.2.0';
try {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(__serverDir, '../package.json'), 'utf8'),
  );
  if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
    APP_VERSION = pkgJson.version.trim();
  }
} catch {
  // fallback version
}

const VALID_SCOPES = new Set(['mainland_onshore', 'freezone_exempt']);
const VALID_CONTROL_IDS = new Set(NAFIS_CONTROLS.map((c) => c.id));

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function computeDigestSync(canonicalText) {
  return crypto.createHash('sha256').update(String(canonicalText || ''), 'utf8').digest('hex');
}

function makeValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'VALIDATION_ERROR';
  return err;
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function sendAttachment(res, contentType, filename, content) {
  const safeName = String(filename || 'download').replace(/[\r\n"\\/]/g, '') || 'download';
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': buf.byteLength,
    'Content-Disposition': `attachment; filename="${safeName}"`,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(buf);
}

async function readJsonBody(req, maxJsonBodyBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxJsonBodyBytes) {
      const err = new Error(`JSON payload exceeds ${maxJsonBodyBytes} byte limit`);
      err.statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON payload');
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`;
  return trimmed.replace(/\/+$/, '');
}

function resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath = '') {
  if (normalizedAppOrigin) return normalizedAppOrigin;
  const protoHeader = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const proto = protoHeader || (req.socket?.encrypted ? 'https' : 'http');
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:4219')
    .split(',')[0]
    .trim();
  return `${proto}://${hostHeader}${normalizedBasePath}`;
}

function pickStr(srcVal, fallbackVal) {
  if (srcVal === undefined || srcVal === null) return String(fallbackVal ?? '').trim();
  return String(srcVal).trim();
}

function pickIsoDate(srcVal, fallbackVal) {
  if (srcVal === undefined || srcVal === null || srcVal === '') {
    return String(fallbackVal || '2026-12-31');
  }
  const raw = String(srcVal).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw makeValidationError(`Invalid ISO date "${raw}". Expected YYYY-MM-DD.`);
  }
  return raw;
}

function pickNonNegInt(srcVal, fallbackVal) {
  if (srcVal === undefined || srcVal === null || srcVal === '') return fallbackVal;
  const n = Number(srcVal);
  if (!Number.isFinite(n) || n < 0) {
    throw makeValidationError(`Expected non-negative finite number, received "${srcVal}".`);
  }
  return Math.trunc(n);
}

function normalizeSector(rawSector, fallbackSector) {
  const val = pickStr(rawSector, fallbackSector);
  if (val === 'other_non_designated' || DESIGNATED_SECTOR_IDS.has(val)) {
    return val;
  }
  throw makeValidationError(`Unsupported economic sector "${val}".`);
}

function mergeAssessmentInput(patchInput, baseInput) {
  const fb = baseInput || NAFIS_PRESETS[0].input;
  const src = patchInput && typeof patchInput === 'object' ? patchInput : {};
  const scopeRaw = pickStr(src.scope, fb.scope);
  if (src.scope !== undefined && !VALID_SCOPES.has(scopeRaw)) {
    throw makeValidationError(`Unsupported scope "${scopeRaw}". Expected mainland_onshore or freezone_exempt.`);
  }

  let implementedControls = fb.implementedControls;
  if (Array.isArray(src.implementedControls)) {
    implementedControls = Array.from(
      new Set(src.implementedControls.filter((id) => VALID_CONTROL_IDS.has(id))),
    );
  }

  let daysSinceRecentEmiratiResignation = fb.daysSinceRecentEmiratiResignation ?? null;
  if (src.daysSinceRecentEmiratiResignation !== undefined) {
    if (src.daysSinceRecentEmiratiResignation === null || src.daysSinceRecentEmiratiResignation === '') {
      daysSinceRecentEmiratiResignation = null;
    } else {
      daysSinceRecentEmiratiResignation = pickNonNegInt(src.daysSinceRecentEmiratiResignation, 0);
    }
  }

  const payrollCsv =
    typeof src.payrollCsv === 'string'
      ? src.payrollCsv
      : src.payrollCsv === null
        ? undefined
        : fb.payrollCsv;

  const activeEligibleEmiratis =
    src.activeEligibleEmiratis !== undefined
      ? pickNonNegInt(src.activeEligibleEmiratis, fb.activeEligibleEmiratis ?? 0)
      : fb.activeEligibleEmiratis;

  return {
    establishmentName: pickStr(src.establishmentName, fb.establishmentName) || fb.establishmentName,
    assessmentDate: pickIsoDate(src.assessmentDate, fb.assessmentDate),
    scope: VALID_SCOPES.has(scopeRaw) ? scopeRaw : fb.scope,
    totalWorkforceCount: pickNonNegInt(src.totalWorkforceCount, fb.totalWorkforceCount),
    skilledWorkforceCount: pickNonNegInt(src.skilledWorkforceCount, fb.skilledWorkforceCount),
    sector: normalizeSector(src.sector, fb.sector),
    activeEligibleEmiratis,
    payrollCsv,
    daysSinceRecentEmiratiResignation,
    implementedControls,
    notes: typeof src.notes === 'string' ? src.notes : fb.notes,
  };
}

function runCoreEngineSafely(fn) {
  try {
    return fn();
  } catch (err) {
    throw makeValidationError(err instanceof Error ? err.message : String(err));
  }
}

async function runCoreAssessmentSafely(input) {
  try {
    return await assessNafisReadiness(input);
  } catch (err) {
    throw makeValidationError(err instanceof Error ? err.message : String(err));
  }
}

function buildEstablishmentSummaryCsv(dossier) {
  const d = dossier;
  const q = d.result.quota;
  const header = [
    'dossier_code',
    'establishment_name',
    'assessment_date',
    'scope',
    'sector',
    'tier',
    'target_rate_pct',
    'required_emiratis',
    'active_eligible_emiratis',
    'shortfall_slots',
    'monthly_penalty_aed',
    'annual_penalty_aed',
    'grace_backfill_active',
    'potential_annual_penalty_aed',
    'status',
    'readiness_score',
  ].join(',');

  const row = [
    sanitizeCsvCell(d.dossierCode || 'DRAFT'),
    sanitizeCsvCell(d.result.establishmentName),
    sanitizeCsvCell(d.result.assessmentDate),
    sanitizeCsvCell(d.result.scope),
    sanitizeCsvCell(d.input.sector),
    sanitizeCsvCell(q.tier),
    sanitizeCsvCell(q.targetRatePct),
    sanitizeCsvCell(q.requiredEmiratis),
    sanitizeCsvCell(q.activeEligibleEmiratis),
    sanitizeCsvCell(q.shortfallSlots),
    sanitizeCsvCell(q.monthlyPenaltyAed),
    sanitizeCsvCell(q.annualPenaltyAed),
    sanitizeCsvCell(q.graceBackfillActive),
    sanitizeCsvCell(q.potentialAnnualPenaltyAed),
    sanitizeCsvCell(d.result.status),
    sanitizeCsvCell(d.result.readinessScore),
  ].join(',');

  return `\uFEFF${header}\n${row}\n`;
}

function buildExecutiveSummaryText(dossier, locale = 'ar') {
  const code = dossier.dossierCode || 'DRAFT';
  const { result } = dossier;
  const q = result.quota;

  if (locale === 'en') {
    return [
      `UAE Emiratisation Readiness Summary (NafisCheck) — ${code}`,
      `Establishment: ${result.establishmentName} · Tier: ${q.tier} · Assessment: ${result.assessmentDate}`,
      `Readiness: ${result.status.toUpperCase()} (${result.readinessScore}/100) · Target: ${q.targetRatePct}% (${q.activeEligibleEmiratis}/${q.requiredEmiratis} Emiratis)`,
      `Shortfall Slots: ${q.shortfallSlots} · Annual Penalty: AED ${q.annualPenaltyAed.toLocaleString('en-US')} (Potential: AED ${q.potentialAnnualPenaltyAed.toLocaleString('en-US')})`,
      `Notice: ${result.legalDisclaimerEn}`,
    ].join('\n');
  }

  return [
    `ملخص جاهزية التوطين الإماراتي ونافس (NafisCheck) — ${code}`,
    `المنشأة: ${result.establishmentName} · الفئة: ${q.tier} · تاريخ التقييم: ${result.assessmentDate}`,
    `الجاهزية: ${result.status.toUpperCase()} (${result.readinessScore}/100) · المستهدف: ${q.targetRatePct}% (${q.activeEligibleEmiratis}/${q.requiredEmiratis} مواطن)`,
    `الشواغر الناقصة: ${q.shortfallSlots} · الغرامة السنوية: ${q.annualPenaltyAed.toLocaleString('en-US')} د.إ (المحتملة: ${q.potentialAnnualPenaltyAed.toLocaleString('en-US')} د.إ)`,
    `تنويه: ${result.legalDisclaimerAr}`,
  ].join('\n');
}

function serveStaticAsset(res, pathname, resolvedDist, method = 'GET', normalizedBasePath = '') {
  if (!resolvedDist || !fs.existsSync(resolvedDist)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(pathname || '/');
  } catch {
    sendJson(res, 400, { error: 'Malformed path' });
    return;
  }

  const cleanRel = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedDist, cleanRel || 'index.html');
  if (candidate !== resolvedDist && !candidate.startsWith(resolvedDist + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let fileToServe = null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else {
    const indexFallback = path.join(resolvedDist, 'index.html');
    if (fs.existsSync(indexFallback) && fs.statSync(indexFallback).isFile()) {
      fileToServe = indexFallback;
    }
  }

  if (!fileToServe) {
    sendJson(res, 404, { error: 'Static asset not found' });
    return;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

  if (ext === '.html') {
    let html = fs.readFileSync(fileToServe, 'utf8');
    if (normalizedBasePath) {
      html = html
        .replaceAll('href="/', `href="${normalizedBasePath}/`)
        .replaceAll('src="/', `src="${normalizedBasePath}/`);
    }
    const baseScript = `<script>window.__NAFISCHECK_BASE__=${JSON.stringify(normalizedBasePath)};</script>`;
    html = html.includes('</head>') ? html.replace('</head>', `${baseScript}</head>`) : `${baseScript}${html}`;
    const bodyBuf = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': bodyBuf.byteLength,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(bodyBuf);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ...SECURITY_HEADERS,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(fileToServe).pipe(res);
}

export function createNafisCheckServer({
  dataDir,
  distDir = '',
  appOrigin = '',
  basePath = '',
  maxMutationsPerMinute = 120,
  maxJsonBodyBytes = 5 * 1024 * 1024,
}) {
  const db = openNafisDatabase(dataDir);
  const resolvedDist = distDir ? path.resolve(distDir) : null;
  const normalizedAppOrigin = String(appOrigin || '').replace(/\/+$/, '');
  const normalizedBasePath = normalizeBasePath(basePath);
  const rateBuckets = new Map();

  function checkRateLimit(req, method) {
    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
      return true;
    }
    const now = Date.now();
    const ip =
      String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1')
        .split(',')[0]
        .trim() || '127.0.0.1';
    const windowMs = 60_000;
    const prev = rateBuckets.get(ip) || [];
    const recent = prev.filter((ts) => now - ts < windowMs);
    if (recent.length >= maxMutationsPerMinute) {
      rateBuckets.set(ip, recent);
      return false;
    }
    recent.push(now);
    rateBuckets.set(ip, recent);
    return true;
  }

  function buildPublicReportUrl(req, slugOrCode) {
    return `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/r/${encodeURIComponent(slugOrCode)}`;
  }

  function findStoredDossier(id) {
    return db.getDossierById(id) || db.getDossierBySlugOrCode(id);
  }

  function buildHealthPayload() {
    const stats = db.getStats();
    return {
      ok: true,
      service: 'nafischeck',
      version: APP_VERSION,
      basePath: normalizedBasePath || '/',
      ...stats,
      timestamp: new Date().toISOString(),
    };
  }

  function handleReadyz(res) {
    try {
      const ready = db.checkReady();
      if (!ready) {
        return sendJson(res, 503, {
          ok: false,
          ready: false,
          service: 'nafischeck',
          error: 'SQLite database health check failed',
        });
      }
      return sendJson(res, 200, {
        ok: true,
        ready: true,
        service: 'nafischeck',
        dbMode: 'WAL',
        version: APP_VERSION,
      });
    } catch (err) {
      return sendJson(res, 503, {
        ok: false,
        ready: false,
        service: 'nafischeck',
        error: err instanceof Error ? err.message : 'SQLite database unavailable',
      });
    }
  }

  async function handleApiRequest(req, res, method, pathname, searchParams) {
    if (!checkRateLimit(req, method)) {
      return sendJson(res, 429, {
        error: 'Too many write requests; please slow down and try again shortly.',
        code: 'RATE_LIMITED',
      });
    }

    // 1. Health, Readyz & Presets
    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, buildHealthPayload());
    }

    if (method === 'GET' && pathname === '/api/readyz') {
      return handleReadyz(res);
    }

    if (method === 'GET' && pathname === '/api/presets') {
      return sendJson(res, 200, {
        presets: NAFIS_PRESETS,
        sectors: DESIGNATED_14_SECTORS,
        controls: NAFIS_CONTROLS,
        rules: {
          emiratiMinSalaryAed: EMIRATI_MIN_SALARY_AED,
          minSalaryEffectiveDate: MIN_SALARY_EFFECTIVE_DATE,
          minSalaryGraceEndDate: MIN_SALARY_GRACE_END_DATE,
          backfillGraceDays: BACKFILL_GRACE_DAYS,
          target2026H1Pct: 9,
          target2026H2Pct: 10,
        },
        disclaimers: {
          ar: LEGAL_DISCLAIMER_AR,
          en: LEGAL_DISCLAIMER_EN,
        },
        sampleCsv: NAFIS_PRESETS[2].input.payrollCsv || '',
      });
    }

    // 2. Stateless Quota, Payroll CSV & Full Readiness Analyzers
    if (method === 'POST' && pathname === '/api/quota') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const merged = mergeAssessmentInput(body, NAFIS_PRESETS[0].input);
      const resolvedActive = merged.activeEligibleEmiratis ?? 0;
      const quota = runCoreEngineSafely(() => evaluateNafisQuota(merged, resolvedActive));
      return sendJson(res, 200, { input: merged, quota });
    }

    if (method === 'POST' && pathname === '/api/payroll-csv-audit') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const csvText = String(body?.csv ?? body?.payrollCsv ?? '');
      if (!csvText.trim()) {
        return sendJson(res, 400, { error: 'Payroll CSV payload is required', code: 'EMPTY_CSV' });
      }
      const assessmentDate = pickIsoDate(body?.assessmentDate, '2026-12-31');
      const audit = runCoreEngineSafely(() => auditEmiratiPayrollCsv(csvText, assessmentDate));
      const exportCsv = exportPayrollAuditCsv(audit);
      return sendJson(res, 200, {
        assessmentDate,
        audit,
        exportCsv,
      });
    }

    if (method === 'POST' && pathname === '/api/assess') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const basePreset = NAFIS_PRESETS.find((p) => p.id === body?.presetKey) || NAFIS_PRESETS[0];
      const inputSource = body?.input && typeof body.input === 'object' ? body.input : body;
      const input = mergeAssessmentInput(inputSource, basePreset.input);
      const result = await runCoreAssessmentSafely(input);
      return sendJson(res, 200, {
        presetKey: basePreset.id,
        input,
        result,
        sha256Digest: result.dossierSha256,
        briefMarkdownAr: buildNafisBriefMarkdown(input, result, 'DRAFT', result.dossierSha256, 'ar'),
        briefMarkdownEn: buildNafisBriefMarkdown(input, result, 'DRAFT', result.dossierSha256, 'en'),
      });
    }

    // 3. Profiles CRUD
    if (method === 'GET' && pathname === '/api/profiles') {
      return sendJson(res, 200, { profiles: db.listProfiles() });
    }

    if (method === 'POST' && pathname === '/api/profiles') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const profile = db.saveProfile(body || {});
      return sendJson(res, 201, { profile });
    }

    const profDeleteMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
    if (method === 'DELETE' && profDeleteMatch) {
      const id = decodeURIComponent(profDeleteMatch[1] || '');
      const del = db.deleteProfile(id);
      if (!del.deleted) return sendJson(res, 404, { error: 'Profile not found' });
      return sendJson(res, 200, { deleted: true });
    }

    // 4. Dossiers List & Create
    if (method === 'GET' && pathname === '/api/dossiers') {
      return sendJson(res, 200, { dossiers: db.listDossiers() });
    }

    if (method === 'POST' && pathname === '/api/dossiers') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const basePreset = NAFIS_PRESETS.find((p) => p.id === body?.presetKey) || NAFIS_PRESETS[0];
      const nowIso = new Date().toISOString();
      const actor = String(body?.actor || 'nafis-coordinator').trim() || 'nafis-coordinator';
      const inputSource = body?.input && typeof body.input === 'object' ? body.input : body;
      const input = mergeAssessmentInput(inputSource, basePreset.input);
      const result = await runCoreAssessmentSafely(input);

      const bundle = db.createDossier(
        {
          presetKey: basePreset.id,
          slug:
            typeof body?.slug === 'string'
              ? body.slug
              : typeof body?.publicSlug === 'string'
                ? body.publicSlug
                : undefined,
          localeDefault: body?.localeDefault === 'en' ? 'en' : 'ar',
          input,
          result,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        actor,
      );

      return sendJson(res, 201, {
        ...bundle,
        publicReportUrl: buildPublicReportUrl(req, bundle.dossier.slug),
      });
    }

    // 5. Dossier Actions: Duplicate & Finalize / Lock
    const dupMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/duplicate$/);
    if (method === 'POST' && dupMatch) {
      const id = decodeURIComponent(dupMatch[1] || '');
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const actor = String(body?.actor || 'nafis-coordinator').trim() || 'nafis-coordinator';
      const cloned = db.duplicateDossier(id, actor);
      if (!cloned) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 201, {
        ...cloned,
        publicReportUrl: buildPublicReportUrl(req, cloned.dossier.slug),
      });
    }

    const finalizeMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/(finalize|lock)$/);
    if (method === 'POST' && finalizeMatch) {
      const id = decodeURIComponent(finalizeMatch[1] || '');
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const actor = String(body?.actor || 'nafis-coordinator').trim() || 'nafis-coordinator';
      const lockedBundle = db.finalizeDossier(id, computeDigestSync, actor);
      if (!lockedBundle) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 200, {
        ...lockedBundle,
        publicReportUrl: buildPublicReportUrl(
          req,
          lockedBundle.dossier.dossierCode || lockedBundle.dossier.slug,
        ),
      });
    }

    // 6. Per-Dossier Markdown Brief, Formula-Safe BOM CSV & Executive Summary
    const mdMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/(?:brief|dossier)\.md$/);
    if (method === 'GET' && mdMatch) {
      const bundle = findStoredDossier(decodeURIComponent(mdMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'en' ? 'en' : 'ar';
      const d = bundle.dossier;
      const digest = d.sha256Digest || d.result.dossierSha256;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'nafischeck');
      return sendAttachment(
        res,
        'text/markdown; charset=utf-8',
        `nafischeck-brief-${fname}-${locale}.md`,
        buildNafisBriefMarkdown(d.input, d.result, d.dossierCode || 'DRAFT', digest, locale),
      );
    }

    const csvMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/export\.csv$/);
    if (method === 'GET' && csvMatch) {
      const bundle = findStoredDossier(decodeURIComponent(csvMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const d = bundle.dossier;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'nafischeck');
      const safeCsv =
        d.result.payrollAudit && d.result.payrollAudit.rows.length > 0
          ? exportPayrollAuditCsv(d.result.payrollAudit)
          : buildEstablishmentSummaryCsv(d);
      return sendAttachment(res, 'text/csv; charset=utf-8', `nafischeck-${fname}.csv`, safeCsv);
    }

    const summaryMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/summary$/);
    if (method === 'GET' && summaryMatch) {
      const bundle = findStoredDossier(decodeURIComponent(summaryMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'en' ? 'en' : 'ar';
      const d = bundle.dossier;
      return sendJson(res, 200, {
        locale,
        dossierCode: d.dossierCode || null,
        status: bundle.status,
        readinessStatus: d.result.status,
        readinessScore: d.result.readinessScore,
        tier: d.result.quota.tier,
        shortfallSlots: d.result.quota.shortfallSlots,
        annualPenaltyAed: d.result.quota.annualPenaltyAed,
        potentialAnnualPenaltyAed: d.result.quota.potentialAnnualPenaltyAed,
        graceBackfillActive: d.result.quota.graceBackfillActive,
        summaryText: buildExecutiveSummaryText(d, locale),
      });
    }

    // 7. Single Dossier Read, Update & Delete
    const dossierMatch = pathname.match(/^\/api\/dossiers\/([^/]+)$/);
    if (dossierMatch) {
      const id = decodeURIComponent(dossierMatch[1] || '');
      if (method === 'GET') {
        const bundle = findStoredDossier(id);
        if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...bundle,
          publicReportUrl: buildPublicReportUrl(
            req,
            bundle.dossier.dossierCode || bundle.dossier.slug,
          ),
        });
      }
      if (method === 'PATCH') {
        const patch = await readJsonBody(req, maxJsonBodyBytes);
        const nowIso = new Date().toISOString();

        const existing = findStoredDossier(id);
        if (!existing) return sendJson(res, 404, { error: 'Dossier not found' });
        if (existing.status === 'locked' || existing.dossier?.lockedAt) {
          return sendJson(res, 409, {
            error: 'Sealed NafisCheck dossier is immutable against modification.',
            code: 'DOSSIER_LOCKED',
          });
        }

        const inputSource = patch?.input && typeof patch.input === 'object' ? patch.input : patch;
        const nextInput = mergeAssessmentInput(inputSource, existing.dossier.input);
        const nextResult = await runCoreAssessmentSafely(nextInput);

        const updated = db.updateDossier(
          id,
          (current) => {
            const requestedSlug =
              typeof patch?.slug === 'string' && patch.slug.trim()
                ? patch.slug.trim()
                : typeof patch?.publicSlug === 'string' && patch.publicSlug.trim()
                  ? patch.publicSlug.trim()
                  : current.slug;

            return {
              ...current,
              slug: requestedSlug,
              localeDefault:
                patch?.localeDefault === 'ar'
                  ? 'ar'
                  : patch?.localeDefault === 'en'
                    ? 'en'
                    : current.localeDefault,
              input: nextInput,
              result: nextResult,
              updatedAt: nowIso,
            };
          },
          String(patch?.actor || 'nafis-coordinator').trim() || 'nafis-coordinator',
        );

        if (!updated) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...updated,
          publicReportUrl: buildPublicReportUrl(req, updated.dossier.slug),
        });
      }
      if (method === 'DELETE') {
        const del = db.deleteDossier(id);
        if (!del.deleted) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, { deleted: true, id: del.id });
      }
    }

    // 8. Public Shareable Report (/api/public/reports/:slugOrCode)
    const pubMatch = pathname.match(/^\/api\/public\/reports\/([^/]+)$/);
    if (method === 'GET' && pubMatch) {
      const slugOrCode = decodeURIComponent(pubMatch[1] || '');
      const bundle = db.getDossierBySlugOrCode(slugOrCode, { incrementView: true });
      if (!bundle) return sendJson(res, 404, { error: 'NafisCheck readiness dossier not found' });
      const d = bundle.dossier;
      const digest = d.sha256Digest || d.result.dossierSha256;

      return sendJson(res, 200, {
        ...bundle,
        markdownAr: buildNafisBriefMarkdown(d.input, d.result, d.dossierCode || 'DRAFT', digest, 'ar'),
        markdownEn: buildNafisBriefMarkdown(d.input, d.result, d.dossierCode || 'DRAFT', digest, 'en'),
        publicReportUrl: buildPublicReportUrl(req, d.dossierCode || d.slug),
      });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  async function handler(req, res) {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      let pathname = parsedUrl.pathname;
      if (
        normalizedBasePath &&
        (pathname === normalizedBasePath || pathname.startsWith(`${normalizedBasePath}/`))
      ) {
        pathname = pathname.slice(normalizedBasePath.length) || '/';
      }
      const method = String(req.method || 'GET').toUpperCase();

      if (method === 'GET' && pathname === '/health') {
        sendJson(res, 200, buildHealthPayload());
        return;
      }

      if (method === 'GET' && pathname === '/readyz') {
        handleReadyz(res);
        return;
      }

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, method, pathname, parsedUrl.searchParams);
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      serveStaticAsset(res, pathname, resolvedDist, method, normalizedBasePath);
    } catch (err) {
      const statusCode = err?.statusCode || 500;
      const payload = {
        error: err?.message || 'Internal server error',
        ...(err?.code ? { code: err.code } : {}),
      };
      if (!res.headersSent) {
        sendJson(res, statusCode, payload);
      } else {
        res.end();
      }
    }
  }

  return {
    handler,
    close: () => db.close(),
  };
}
