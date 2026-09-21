# EMCY Dashboard

Work-tracking dashboard for EMCY (Morocco Cyber Space Youth). Admins create tasks and assign them to members, members report their progress and submit deliverables, and everything shows up on a dashboard with weekly logs and a ranking.

React + Vite on the front, Express on the back. Storage is JSON files in dev and Netlify Blobs in production, so there is no external database to set up.

## Features

- Task management: assign tasks with deadlines, members submit work as a file upload or a link
- Weekly progress tracking with a ranking page
- Members management with roles (owner / admin / member)
- Shared resources area for team documents
- JWT auth, member emails restricted to `@emcy.ma`

## Project structure

```
├── client/               # React + Vite frontend
│   ├── public/           # Static assets & logos
│   └── src/              # Components, pages, context, services
├── server/               # Express API
│   ├── config/           # Database, storage driver, backups
│   ├── middleware/       # Auth, logging
│   ├── models/           # Data models
│   ├── routes/           # REST endpoints (auth, tasks, users, ...)
│   └── scripts/          # Maintenance scripts
├── netlify/functions/    # Serverless API entry for Netlify deploys
└── docs/                 # Presentation & supporting docs
```

## Getting started

```bash
cd server && npm install && npm run dev   # API on :5000 (local filesystem store)
cd client && npm install && npm run dev   # Web on :5173 (proxies /api and /uploads to :5000)
```

On Windows, `run.bat` starts both in one click.

Dev login: `admin@emcy.com` / `admin123`. In production the initial password comes from `ADMIN_SEED_PASSWORD` instead, so change it right after the first deploy. Demo members are only seeded in dev.

Server config lives in `server/.env` (see `server/.env.example`).

## Deploying to Netlify

The whole app runs on Netlify: the React build is served from the CDN and the Express API runs as a serverless function, with the database and uploads in Netlify Blobs (built in, nothing to create). Storage picks Blobs automatically on Netlify and the local filesystem in dev.

1. Push this repo to GitHub.
2. On app.netlify.com, "Add new site > Import an existing project" and pick the repo.
3. Before the first deploy, set these environment variables under Site configuration:
   - `JWT_SECRET`, required. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. A fallback is auto-generated if you skip it, but set your own.
   - `ADMIN_SEED_PASSWORD`, the initial owner password. Without it the owner starts on the well-known `admin123`.
4. Deploy. `netlify.toml` already has the build command, publish dir and function config.
5. Check `https://<your-site>.netlify.app/api/health` returns `{"status":"ok","store":"blobs","db":"ready"}`. If it says `degraded`, look at the function logs.
6. Log in as `admin@emcy.com` and change the password.

Every write snapshots a restore point (last 20 kept), so deploys never wipe data, and a corrupted collection is recovered from the newest snapshot. Function request bodies are capped around 6 MB, so larger files should be shared as links instead of uploads.

There is also a `render.yaml` if you prefer Render (single service, filesystem disk).

## Testing

The serverless path (Netlify Blobs, function handler, cold starts) has a test harness that runs against a mocked file-backed blobs store:

```bash
node server/test/function-harness.cjs
```

To try a production-style local run:

```bash
cd client && npm run build
cd ../server && NODE_ENV=production PORT=8080 ADMIN_SEED_PASSWORD=xxx node server.js
# http://localhost:8080 serves the app and the API together
```
