import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  NAFIS_PRESETS,
  computePayloadDigest,
  type AssessmentResult,
} from '../../src/core/index.ts';
import { createNafisCheckServer } from '../../server/app.mjs';

interface StartedServer {
  baseUrl: string;
  closeAll: () => Promise<void>;
}

const cleanups: Array<() => Promise<void>> = [];

async function startTempServer(
  options: {
    basePath?: string;
    maxMutationsPerMinute?: number;
    maxJsonBodyBytes?: number;
    withFakeDist?: boolean;
  } = {},
): Promise<StartedServer> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nafischeck-test-'));
  const dataDir = path.join(tempDir, 'data');
  const distDir = path.join(tempDir, 'dist');
  if (options.withFakeDist) {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<!doctype html><html><head><script src="/assets/main.js"></script></head><body>NAFISCHECK_SPA</body></html>',
      'utf8',
    );
  }

  const { handler, close } = createNafisCheckServer({
    dataDir,
    distDir: options.withFakeDist ? distDir : '',
    basePath: options.basePath ?? '',
    maxMutationsPerMinute: options.maxMutationsPerMinute ?? 120,
    maxJsonBodyBytes: options.maxJsonBodyBytes ?? 5 * 1024 * 1024,
  });

  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const prefix = options.basePath ? options.basePath.replace(/\/+$/, '') : '';
  const baseUrl = `http://127.0.0.1:${port}${prefix}`;

  const closeAll = async (): Promise<void> => {
    close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  };
  cleanups.push(closeAll);
  return { baseUrl, closeAll };
}

function buildCompliant12EmiratiCsv(): string {
  const rows = [
    'employee_id,full_name,nationality,role_tier,monthly_salary_aed,hire_date,registered_in_wps,registered_in_pension',
  ];
  for (let i = 1; i <= 12; i += 1) {
    rows.push(`EMP-20${i},Emirati Staff ${i},AE,skilled,6800,2025-05-01,true,true`);
  }
  return rows.join('\n');
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

describe('NafisCheck Phase 2 SQLite WAL server', () => {
  it('serves health, readyz, BASE_PATH HTML injection, presets, quota, payroll CSV & full assessment', async () => {
    const srv = await startTempServer({ basePath: '/nafischeck', withFakeDist: true });

    const rootHealthRes = await fetch(`${srv.baseUrl}/health`);
    expect(rootHealthRes.status).toBe(200);
    const rootHealth = (await rootHealthRes.json()) as Record<string, unknown>;
    expect(rootHealth.ok).toBe(true);
    expect(rootHealth.service).toBe('nafischeck');
    expect(String(rootHealth.version)).toMatch(/^\d+\.\d+\.\d+$/);
    expect(rootHealth.basePath).toBe('/nafischeck');

    const apiHealthRes = await fetch(`${srv.baseUrl}/api/health`);
    expect(apiHealthRes.status).toBe(200);

    const readyzRes = await fetch(`${srv.baseUrl}/readyz`);
    expect(readyzRes.status).toBe(200);
    const readyz = (await readyzRes.json()) as Record<string, unknown>;
    expect(readyz.ok).toBe(true);
    expect(readyz.ready).toBe(true);
    expect(readyz.dbMode).toBe('WAL');

    const apiReadyzRes = await fetch(`${srv.baseUrl}/api/readyz`);
    expect(apiReadyzRes.status).toBe(200);

    const htmlRes = await fetch(`${srv.baseUrl}/`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('window.__NAFISCHECK_BASE__="/nafischeck"');
    expect(html).toContain('src="/nafischeck/assets/main.js"');

    const presetsRes = await fetch(`${srv.baseUrl}/api/presets`);
    expect(presetsRes.status).toBe(200);
    const presetsJson = (await presetsRes.json()) as {
      presets: unknown[];
      sectors: unknown[];
      controls: unknown[];
      rules: { emiratiMinSalaryAed: number; target2026H2Pct: number };
      disclaimers: { ar: string; en: string };
      sampleCsv: string;
    };
    expect(presetsJson.presets).toHaveLength(3);
    expect(presetsJson.sectors).toHaveLength(14);
    expect(presetsJson.controls).toHaveLength(6);
    expect(presetsJson.rules.emiratiMinSalaryAed).toBe(6000);
    expect(presetsJson.rules.target2026H2Pct).toBe(10);
    expect(presetsJson.disclaimers.ar).toContain('ليست تابعة');
    expect(presetsJson.disclaimers.en).toContain('NOT affiliated');
    expect(presetsJson.sampleCsv).toContain('Hamad Al Mazrouei');

    // Stateless quota check (50+ skilled shortfall)
    const quotaRes = await fetch(`${srv.baseUrl}/api/quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        establishmentName: 'Emirates Horizon Construction',
        assessmentDate: '2026-12-31',
        scope: 'mainland_onshore',
        totalWorkforceCount: 150,
        skilledWorkforceCount: 100,
        sector: 'construction',
        activeEligibleEmiratis: 7,
      }),
    });
    expect(quotaRes.status).toBe(200);
    const quotaJson = (await quotaRes.json()) as {
      quota: {
        tier: string;
        targetRatePct: number;
        requiredEmiratis: number;
        shortfallSlots: number;
        annualPenaltyAed: number;
      };
    };
    expect(quotaJson.quota.tier).toBe('large_50_plus');
    expect(quotaJson.quota.targetRatePct).toBe(10);
    expect(quotaJson.quota.requiredEmiratis).toBe(10);
    expect(quotaJson.quota.shortfallSlots).toBe(3);
    expect(quotaJson.quota.annualPenaltyAed).toBe(360000);

    // Empty CSV 400 + dangerous CSV formula escaping with UTF-8 BOM
    const emptyCsvRes = await fetch(`${srv.baseUrl}/api/payroll-csv-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: '   ' }),
    });
    expect(emptyCsvRes.status).toBe(400);

    const dangerousCsv = [
      'employee_id,full_name,nationality,role_tier,monthly_salary_aed,hire_date,registered_in_wps,registered_in_pension',
      'E-1,=CMD|calc,AE,skilled,6500,2025-05-01,true,true',
      'E-2,Sub 6k Worker,AE,skilled,5100,2025-05-01,true,true',
    ].join('\n');
    const csvAuditRes = await fetch(`${srv.baseUrl}/api/payroll-csv-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: dangerousCsv, assessmentDate: '2026-12-31' }),
    });
    expect(csvAuditRes.status).toBe(200);
    const csvAuditJson = (await csvAuditRes.json()) as {
      audit: { eligibleEmiratiCount: number; excludedSub6kCount: number };
      exportCsv: string;
    };
    expect(csvAuditJson.audit.eligibleEmiratiCount).toBe(1);
    expect(csvAuditJson.audit.excludedSub6kCount).toBe(1);
    expect(csvAuditJson.exportCsv.startsWith('\uFEFF')).toBe(true);
    expect(csvAuditJson.exportCsv).toContain("'=CMD|calc");

    // Full stateless assessment on blocked Preset #3
    const assessRes = await fetch(`${srv.baseUrl}/api/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey: NAFIS_PRESETS[2]!.id }),
    });
    expect(assessRes.status).toBe(200);
    const assessJson = (await assessRes.json()) as {
      result: AssessmentResult;
      sha256Digest: string;
      briefMarkdownAr: string;
      briefMarkdownEn: string;
    };
    expect(assessJson.result.status).toBe('blocked');
    expect(assessJson.result.quota.shortfallSlots).toBe(4);
    expect(assessJson.result.quota.annualPenaltyAed).toBe(480000);
    expect(assessJson.sha256Digest).toMatch(/^[a-f0-9]{64}$/);
    expect(assessJson.briefMarkdownAr).toContain('ليست تابعة');
    expect(assessJson.briefMarkdownEn).toContain('NOT affiliated');
  });

  it('persists profiles & dossiers in SQLite WAL, stamps atomic NAF-YYYY-0001, enforces 409 lock, and serves exports + views', async () => {
    const srv = await startTempServer({ basePath: '/nafischeck' });

    const profRes = await fetch(`${srv.baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        establishmentName: 'Al Majd Logistics Group',
        scope: 'mainland_onshore',
        sector: 'transportation_storage',
        totalWorkforceCount: 42,
        skilledWorkforceCount: 28,
        notes: 'Core UAE onshore fleet',
      }),
    });
    expect(profRes.status).toBe(201);
    const profList = (await (await fetch(`${srv.baseUrl}/api/profiles`)).json()) as {
      profiles: Array<{ id: string; profile: { establishmentName: string } }>;
    };
    expect(profList.profiles).toHaveLength(1);
    expect(profList.profiles[0]!.profile.establishmentName).toBe('Al Majd Logistics Group');

    const delProfRes = await fetch(`${srv.baseUrl}/api/profiles/${profList.profiles[0]!.id}`, {
      method: 'DELETE',
    });
    expect(delProfRes.status).toBe(200);

    // Create blocked Preset #3 dossier
    const createRes = await fetch(`${srv.baseUrl}/api/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey: NAFIS_PRESETS[2]!.id, localeDefault: 'ar' }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      dossier: { id: string; slug: string; result: AssessmentResult };
      status: string;
    };
    expect(created.status).toBe('draft');
    expect(created.dossier.result.status).toBe('blocked');
    expect(created.dossier.result.quota.annualPenaltyAed).toBe(480000);

    // Remediate blocked dossier into ready state via PATCH
    const patchRes = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payrollCsv: buildCompliant12EmiratiCsv(),
        implementedControls: [
          'NAF-CTRL-01',
          'NAF-CTRL-02',
          'NAF-CTRL-03',
          'NAF-CTRL-04',
          'NAF-CTRL-05',
          'NAF-CTRL-06',
        ],
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as {
      dossier: { result: AssessmentResult };
    };
    expect(patched.dossier.result.status).toBe('ready');
    expect(patched.dossier.result.readinessScore).toBe(100);
    expect(patched.dossier.result.quota.shortfallSlots).toBe(0);
    expect(patched.dossier.result.quota.annualPenaltyAed).toBe(0);

    // Finalize atomically to NAF-YYYY-0001
    const finalizeRes = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'hr-compliance-director' }),
    });
    expect(finalizeRes.status).toBe(200);
    const locked = (await finalizeRes.json()) as {
      status: string;
      dossier: {
        dossierCode: string;
        sha256Digest: string;
        result: AssessmentResult;
      };
    };
    const year = new Date().getUTCFullYear();
    expect(locked.status).toBe('locked');
    expect(locked.dossier.dossierCode).toBe(`NAF-${year}-0001`);
    const clientDigest = await computePayloadDigest(locked.dossier.result.canonicalDossierText);
    expect(locked.dossier.sha256Digest).toBe(clientDigest);

    // 409 immutability guards
    const lockedPatch = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalWorkforceCount: 200 }),
    });
    expect(lockedPatch.status).toBe(409);

    const lockedDel = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}`, {
      method: 'DELETE',
    });
    expect(lockedDel.status).toBe(409);

    const relock = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(relock.status).toBe(409);

    // Duplicate & delete editable draft
    const dupRes = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(dupRes.status).toBe(201);
    const dupJson = (await dupRes.json()) as { status: string; dossier: { id: string } };
    expect(dupJson.status).toBe('draft');
    const delDup = await fetch(`${srv.baseUrl}/api/dossiers/${dupJson.dossier.id}`, {
      method: 'DELETE',
    });
    expect(delDup.status).toBe(200);

    // Exports & public share view counter
    const mdRes = await fetch(
      `${srv.baseUrl}/api/dossiers/${locked.dossier.dossierCode}/brief.md?locale=ar`,
    );
    expect(mdRes.status).toBe(200);
    const mdText = await mdRes.text();
    expect(mdText).toContain(locked.dossier.dossierCode);
    expect(mdText).toContain('التوطين الإماراتي');

    const csvRes = await fetch(`${srv.baseUrl}/api/dossiers/${locked.dossier.dossierCode}/export.csv`);
    expect(csvRes.status).toBe(200);
    const csvBuf = Buffer.from(await csvRes.arrayBuffer());
    expect(csvBuf.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
    expect(csvBuf.toString('utf8')).toContain('Emirati Staff 12');

    const sumRes = await fetch(
      `${srv.baseUrl}/api/dossiers/${locked.dossier.dossierCode}/summary?locale=en`,
    );
    expect(sumRes.status).toBe(200);
    const sumJson = (await sumRes.json()) as {
      summaryText: string;
      shortfallSlots: number;
      annualPenaltyAed: number;
    };
    expect(sumJson.shortfallSlots).toBe(0);
    expect(sumJson.annualPenaltyAed).toBe(0);
    expect(sumJson.summaryText).toContain(locked.dossier.dossierCode);
    expect(sumJson.summaryText).toContain('NOT affiliated');

    const pubRes = await fetch(`${srv.baseUrl}/api/public/reports/${locked.dossier.dossierCode}`);
    expect(pubRes.status).toBe(200);
    const pubJson = (await pubRes.json()) as {
      viewCount: number;
      markdownAr: string;
      markdownEn: string;
    };
    expect(pubJson.viewCount).toBe(1);
    expect(pubJson.markdownEn).toContain(locked.dossier.sha256Digest);
    expect(pubJson.markdownAr).toContain('NafisCheck');
  });

  it('enforces 413 payload limits and 429 mutation throttling', async () => {
    const smallLimitSrv = await startTempServer({ maxJsonBodyBytes: 64 });
    const hugeRes = await fetch(`${smallLimitSrv.baseUrl}/api/quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(200) }),
    });
    expect(hugeRes.status).toBe(413);

    const rateSrv = await startTempServer({ maxMutationsPerMinute: 2 });
    const r1 = await fetch(`${rateSrv.baseUrl}/api/quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const r2 = await fetch(`${rateSrv.baseUrl}/api/quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const r3 = await fetch(`${rateSrv.baseUrl}/api/quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
  });
});
