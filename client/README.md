# EMCY Dashboard - Client

React and Vite frontend for the EMCY work-tracking dashboard.

```bash
npm install
npm run dev      # dev server on :5173 (proxies /api and /uploads to the API on :5000)
npm run build    # production build to dist/
npm run lint     # ESLint
```

## Structure

```
src/
├── components/       # Reusable UI (layout, sidebar, logo)
├── context/          # Auth + toast providers
├── pages/            # One page per route (dashboard, tasks, members, ...)
├── services/         # API client (fetch wrapper)
└── utils/            # Helpers (deadlines, email rules, URL resolution)
```

See the [root README](../README.md) for API setup, deployment, and the full architecture.
