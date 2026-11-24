# Changelog — NafisCheck

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-11-24 — Public MIT Open-Source Release (`v0.5.0`)
### Added
- MIT [`LICENSE`](LICENSE), [`.github/workflows/ci.yml`](.github/workflows/ci.yml), six verified Chrome UI captures under [`docs/screenshots/`](docs/screenshots/), and embedded Visual Showcase in [`README.md`](README.md).
- Sanitized public MIT release published on GitHub (`manea/nafischeck` `v0.5.0`).

## [0.4.0] - 2026-11-24
### Added
- Headless Playwright Google Chrome E2E verification (`playwright.config.ts`, `tests/e2e/nafischeck.spec.ts`) across desktop (`1280×800`) and mobile (`390×844`) viewports in both `AR RTL / Sovereign Pearl` and `EN LTR / Abu Dhabi Night`, verifying 20–49 backfill grace, construction payroll CSV sub-AED 6,000 remediation, atomic `NAF-YYYY-0001` sealing, `UTF-8 BOM` CSV download (`EF BB BF`), `/r/:slugOrCode` share routing, zero console/page errors, and zero horizontal overflow (`3/3 passed`).
- `$0` Production & Open-Source Deploy Pack (`wrangler.jsonc`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `deploy/.env.example`, `deploy/Caddyfile`, `deploy/nafischeck.service`, `deploy/backup-sqlite.sh`, `deploy/export-public-github.sh`, `launch/DEPLOY-AND-SHARE.md`, `README.md`) passing `EXPORT_CLEAN_OK`.
- Visual polish fixes from Chrome screenshot review: tier-aware KPI label for `20–49` 14-sector firms, natural RTL/LTR placeholder sizing (`45 (60d grace)`), and `whitespace-nowrap` wrapping for `NAF-YYYY-0001` on `390px` mobile screens.

## [0.3.0] - 2026-11-24
### Added
- Bilingual interactive web application (`AR RTL / EN LTR`) with `Sovereign Pearl` (light default) and `Abu Dhabi Night` (dark) themes built on `React 19 + Vite 8 + Tailwind CSS v4`.
- Modular UI components: `NafisQuotaAndFineSvg.tsx` (quota trajectory gauge + AED annual exposure gauge + statutory gate KPI cards), `EstablishmentScopePanel.tsx` (14 designated sectors, 50+ skilled headcount, 60-day departure grace & saved profiles), `ControlsAndPayrollPanel.tsx` (6 operational controls + live Emirati payroll CSV auditor & CWE-1236 UTF-8 BOM exporter), and `DossierPreviewAndPrint.tsx` (non-MoHRE/non-legal disclaimer, atomic `NAF-YYYY-0001` lock, A4 PDF print layout & `/r/:slugOrCode` share view).
- Dual-mode browser API client (`src/lib/api.ts`, `src/lib/basePath.ts`, `src/lib/i18n.ts`) supporting persistent SQLite WAL server mode or zero-cost `$0` browser `localStorage` fallback.
- Verified with `tsc --noEmit`, `Vitest (13/13)`, `vite build`, and live UI smoke check on `:4220` (`/nafischeck`).

## [0.2.0] - 2026-11-24
### Added
- Zero-dependency Node 22 SQLite WAL persistence & HTTP/API server (`server/db.mjs`, `server/app.mjs`, `server/index.mjs`, `server/app.d.mts`) listening on `:4219` with `BASE_PATH=/nafischeck` stripping & HTML base injection (`window.__NAFISCHECK_BASE__`).
- Endpoints: `/health`, `/readyz`, `/api/health`, `/api/readyz`, `/api/presets`, `/api/quota`, `/api/payroll-csv-audit`, `/api/assess`, `/api/profiles`, `/api/dossiers`, `/duplicate`, `/finalize` (`NAF-YYYY-0001` atomic counter + `409` lock guard + `SHA-256` verification), `/brief.md`, `/export.csv` (`UTF-8 BOM` + CWE-1236 formula defense), `/summary`, and `/api/public/reports/:slugOrCode`.
- Bilingual Markdown brief generator (`src/core/briefBuilder.ts`) and unified canonical payload digest helper (`canonicalizeDossierPayload`, `computePayloadDigest`).
- Server integration suite (`tests/unit/nafisServer.test.ts`, `3/3` tests) and live smoke check on `:4220`.

## [0.1.0] - 2026-11-24
### Added
- Zero-dependency UAE MoHRE / Nafis Emiratisation deterministic core engine (`src/core/*`):
  - Skilled-workforce Emiratisation quota engine (`10%` cumulative target by `2026-12-31` across semi-annual checkpoints, `AED 10,000/month` = `AED 120,000/year` per unfilled slot in `2026+`).
  - `20–49` employee establishment engine covering all `14` MoHRE designated economic sectors (`1` / `2` Emirati requirement, `60`-day backfill grace window, `AED 108,000/year` per shortfall slot).
  - Payroll & `CSV` roster auditor enforcing the **`AED 6,000`** Emirati private-sector minimum wage (`2026-01-01`), `WPS` + `GPSSA/ADPF` pension checks, formula-injection escaping (`CWE-1236`), and `UTF-8 BOM` export.
  - Canonical `SHA-256` dossier digest (`Web Crypto`) and three scenario presets with mandatory non-MoHRE / non-legal disclaimer.
