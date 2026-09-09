# EMCY Dashboard

Work-tracking dashboard for EMCY — Morocco Cyber Space Youth. React + Vite client, Express API, lowdb JSON database.

## Development

```bash
cd server && npm install && npm run dev   # API on :5000
cd client && npm install && npm run dev   # Web on :5173 (proxies /api and /uploads to :5000)
```

Server config lives in `server/.env` (see `server/.env.example`): `PORT`, `JWT_SECRET`, `JWT_EXPIRE`.
Default owner login: `admin@emcy.com` / `admin123` (the admin whose major is "EMCY Management" is the dashboard Owner). Dev-only demo members are seeded on a fresh database; they never appear in production.

## Deploying to Render

The app deploys as **one Render Node service** that serves both the API and the built React app from a single URL, with a persistent disk for the database, backups, and uploaded files.

1. **Push this repo to GitHub.**
2. On [dashboard.render.com](https://dashboard.render.com): **New → Blueprint**, select the repo. Render reads `render.yaml` and pre-fills the service, build/start commands, and the 1 GB disk mounted at `/data`.
3. **Before the first deploy, set `JWT_SECRET`** in the service's Environment tab:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
4. Deploy. The build installs server + client dependencies and produces `client/dist`, which Express serves alongside the API.
5. Open the URL and log in with the seeded owner: `admin@emcy.com` / `admin123` (or `ADMIN_SEED_PASSWORD` if you set it) — **change this password immediately**, the site is public.

Data notes:
- `EMCY_DATA_DIR=/data` and `EMCY_UPLOADS_DIR=/data/uploads` point the database, its automatic backups, and all uploads at the persistent disk, so nothing is lost on redeploy.
- Free tier: the service sleeps after ~15 min idle; the first visit afterwards takes ~30 s to wake.
- The live database starts fresh (owner admin only). Recreate team accounts through the Members UI.

## Local production test

```bash
cd client && npm run build
cd ../server && NODE_ENV=production PORT=8080 node server.js
# http://localhost:8080 serves the app and the API together
```
