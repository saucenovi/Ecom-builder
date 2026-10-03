# Base44 dev environment notes

- Single-process fullstack app: Express (`server.js`) serves both the API (`/api/*`) and the static frontend from `public/`. No CORS or separate backend service needed — everything is one origin on port 3000.
- SQLite via `better-sqlite3`; the DB file lives at `/app/data/droply.db` inside a named compose volume (`DB_FILE` env), NOT in the repo — it survives container rebuilds.
- Schema + seed (products, demo users) run automatically on every server start via `init()` in `server.js`. No migration step needed.
- Start with `docker compose -f docker-compose.base44.yml up -d` (node:22 image, repo bind-mounted at /app, deps installed at container start, `node --watch` for live reload).
- `node --watch` has no polling flag — inotify works fine with the bind mount; don't add `--watch-polling`.
- `JWT_SECRET` is delivered via `/run/base44/app.env`; the current value is a development placeholder.
- Demo accounts: customer `demo@droply.test` / `password123`, admin `admin@droply.test` / `password123`.
- Verify with: `curl http://localhost:3000/api/health` → `{"ok":true,"service":"droply"}`.
- Checkout is design-preview only: no payments, placeholder shipping/tax, orders saved as `pending`.
