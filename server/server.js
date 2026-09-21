const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Load .env BEFORE anything reads process.env.
// override:true so a stray PORT from the parent shell (e.g. PORT=0) can't make
// the server bind to port 0 and appear dead - but in production the platform's
// injected PORT must win, so .env never overrides an already-set value there.
const dotenvResult = require('dotenv').config({
  override: process.env.NODE_ENV !== 'production',
  path: require('path').join(__dirname, '.env'),
});
if (dotenvResult.error) {
  console.warn('⚠️  Could not read server/.env - using environment defaults.');
}

const { seedAdmin, seedDemoData, dbReady, ensureJwtSecret, repairDuplicates } = require('./config/db');
const { UPLOADS_DIR, SERVER_ROOT, DRIVER, ON_NETLIFY } = require('./config/store');
const { readUpload } = require('./config/store');
const requestLogger = require('./middleware/logger');

const app = express();

// --- Serverless path normalization --------------------------------------
// When the Express app runs as a Netlify function, requests arrive with the
// function prefix - and depending on how the platform delivered the URL,
// sometimes with a doubled /api segment - e.g.
//     /.netlify/functions/api/api/health
// Strip those wrappers so every request matches the real routes. Without
// this, unmatched requests fall through to the SPA fallback and the client
// receives HTML instead of JSON ("can't log in" on the deployed site).
app.use((req, res, next) => {
  let p = req.url;
  const FN_PREFIX = '/.netlify/functions/api';
  if (p.startsWith(FN_PREFIX)) {
    p = p.slice(FN_PREFIX.length) || '/';
  }
  if (p.startsWith('/api/api/')) {
    p = p.slice('/api'.length);
  }
  if (p !== req.url) {
    req.originalUrl = req.originalUrl || req.url;
    req.url = p;
  }
  next();
});

// Ensure upload directories exist for the local filesystem driver (multer
// used to fail hard if they were missing; blob storage needs nothing).
if (DRIVER === 'fs') {
  for (const dir of ['', 'avatars', 'work', 'resources']) {
    fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true });
  }
}

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(requestLogger);

// Uploaded files: served straight from the filesystem locally, streamed out
// of the blobs store on Netlify (where /uploads/* has no disk behind it).
if (DRIVER === 'fs') {
  app.use('/uploads', express.static(path.join(UPLOADS_DIR)));
} else {
  // Minimal mime map: binary responses must carry a content-type or
  // serverless-http treats them as text and corrupts the bytes.
  const MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
  };
  app.get('/uploads/*', async (req, res) => {
    const key = req.params[0];
    const data = await readUpload(key);
    if (!data) return res.status(404).json({ message: 'File not found.' });
    const ext = path.extname(key).toLowerCase();
    res.set('Content-Type', MIME[ext] || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(data));
  });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/resources', require('./routes/resources'));

// Health check - reports storage driver + db readiness for deploy debugging
app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await dbReady;
    dbStatus = 'ready';
  } catch (e) {
    dbStatus = 'error: ' + (e.message || 'unknown');
  }
  res.json({
    status: dbStatus === 'ready' ? 'ok' : 'degraded',
    store: DRIVER,
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

// Serve the built React app in production (single-service deployment).
// The SPA fallback lets deep links like /tracker or /members survive a refresh.
const CLIENT_DIST = path.join(SERVER_ROOT, '..', 'client', 'dist');
if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// Central error handler - malformed JSON, multer errors, unexpected failures
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON payload.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File is too large.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Server error.' });
});

const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 5000;

// On Netlify the function handler seeds on cold start and exports the app;
// the express server is NOT started there.
if (!ON_NETLIFY) {
  async function start() {
    await ensureJwtSecret();
    await seedAdmin();
    await seedDemoData();
    await repairDuplicates();
    app.listen(PORT, () => {
      if (process.env.NODE_ENV === 'production') {
        console.log(`\nEMCY Dashboard running on port ${PORT} (API + web app) [store: ${DRIVER}]`);
      } else {
        console.log(`\nEMCY Dashboard API running on http://localhost:${PORT} [store: ${DRIVER}]`);
        console.log(`Health check: http://localhost:${PORT}/api/health\n`);
        console.log('Default login: admin@emcy.com / admin123\n');
      }
    });
  }

  start();
}

// Serverless entry point (netlify/functions/api.js)
module.exports = { app, seedAdmin, seedDemoData, ensureJwtSecret, repairDuplicates, dbReady };
