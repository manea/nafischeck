# Deploying & Sharing NafisCheck (`$0` Production Guide)

NafisCheck supports both **zero-server browser hosting** (`$0 localStorage` + Web Crypto `SHA-256`) and **self-hosted `Node 22 + node:sqlite WAL`** persistence.

---

## Option A: `$0` Cloudflare Workers Static Assets (Zero Server)

1. Build the static frontend:
   ```bash
   npm run build
   ```
2. Deploy with `wrangler.jsonc` already preconfigured for SPA fallback:
   ```bash
   npx wrangler login
   npx wrangler deploy
   ```

---

## Option B: Docker Compose (`Node 22 + SQLite WAL`)

```bash
docker compose up -d --build
# Healthy at http://127.0.0.1:4219/api/health
```

---

## Option C: Systemd + Caddy Reverse Proxy

1. Build `./dist` via `npm ci && npm run build`.
2. Copy `deploy/.env.example` to your data env location (e.g. `/etc/nafischeck/.env`), adjust `PORT=4219`, `BASE_PATH`, and `NAFISCHECK_DATA_DIR`.
3. Install `deploy/nafischeck.service` and reverse-proxy via `deploy/Caddyfile`.
4. Run online WAL snapshots safely via:
   ```bash
   ./deploy/backup-sqlite.sh
   ```
