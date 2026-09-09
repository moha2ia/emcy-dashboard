# EMCY Dashboard

Work-tracking dashboard for EMCY — Morocco Cyber Space Youth. React + Vite client, Express API, JSON database.

## Development

```bash
cd server && npm install && npm run dev   # API on :5000 (local filesystem store)
cd client && npm install && npm run dev   # Web on :5173 (proxies /api and /uploads to :5000)
```

Server config lives in `server/.env` (see `server/.env.example`). Default owner login: `admin@emcy.com` / `admin123` (dev only — in production the initial password comes from `ADMIN_SEED_PASSWORD`). Dev-only demo members are seeded locally; they never appear in production.

## Deploying to Netlify

The app deploys **100% on Netlify**:
- The React app is built to `client/dist` and served from Netlify's CDN.
- The Express API runs as a Netlify **function** (`netlify/functions/api`), wired to `/api/*` and `/uploads/*` via redirects in `netlify.toml`.
- The database, its automatic backups, and all uploaded files live in **Netlify Blobs** (built-in storage — no external service, no account needed). The storage layer (`server/config/store.js`) picks Blobs automatically on Netlify and the local filesystem in dev.

### Steps (dashboard UI)

1. **Push this repo to GitHub.**
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub** → pick this repo.
3. Netlify reads `netlify.toml` — build command, publish dir, and functions are pre-filled. Just click **Deploy**.
4. **After the first deploy**, set the environment variables under **Site configuration → Environment variables**:
   - `ADMIN_SEED_PASSWORD` — the initial owner password (e.g. a strong random string)
   - `JWT_SECRET` — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   Then **Deploys → Trigger deploy → Clear cache and deploy site** so they take effect.
5. Open the site URL, log in as `admin@emcy.com` with your `ADMIN_SEED_PASSWORD`, and **change the password right away** (Profile or Members page).

Netlify Blobs needs no setup: on the first API call, the function provisions the `emcy-db`, `emcy-db-backups`, and `emcy-uploads` stores automatically.

### Good to know

- **Cold starts:** the first API call after inactivity takes ~1–3 s. Subsequent calls are fast.
- **Data lives in Blobs**, so deploys never wipe the database or uploads.
- The live database starts fresh (owner admin only) — recreate team accounts through the Members UI, emails must be `@emcy.ma`.

## Local production-style test

```bash
cd client && npm run build
cd ../server && NODE_ENV=production PORT=8080 ADMIN_SEED_PASSWORD=xxx node server.js
# http://localhost:8080 serves the app and the API together (filesystem store)
```

To exercise the Netlify function locally instead:

```bash
NETLIFY=true EMCY_STORE_DRIVER=fs ADMIN_SEED_PASSWORD=xxx node -e "
const { handler } = require('./netlify/functions/api');
handler({ httpMethod: 'GET', path: '/api/health', headers: {} }, {}).then(r => console.log(r.statusCode));
"
```
