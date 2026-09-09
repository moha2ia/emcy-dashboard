const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Load .env BEFORE anything reads process.env.
// override:true so a stray PORT from the parent shell (e.g. PORT=0) can't make
// the server bind to port 0 and appear dead — but in production the platform's
// injected PORT must win, so .env never overrides an already-set value there.
const dotenvResult = require('dotenv').config({
  override: process.env.NODE_ENV !== 'production',
  path: require('path').join(__dirname, '.env'),
});
if (dotenvResult.error) {
  console.warn('⚠️  Could not read server/.env — using environment defaults.');
}

const { seedAdmin, seedDemoData } = require('./config/db');
const { UPLOADS_DIR, SERVER_ROOT } = require('./config/paths');
const requestLogger = require('./middleware/logger');

const app = express();

// Ensure upload directories exist (multer fails hard if they don't)
for (const dir of ['', 'avatars', 'work']) {
  fs.mkdirSync(path.join(UPLOADS_DIR, dir), { recursive: true });
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
app.use('/uploads', express.static(path.join(UPLOADS_DIR)));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/tasks', require('./routes/tasks'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Central error handler — malformed JSON, multer errors, unexpected failures
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

async function start() {
  await seedAdmin();
  await seedDemoData();
  app.listen(PORT, () => {
    if (process.env.NODE_ENV === 'production') {
      console.log(`\n🚀 EMCY Dashboard running on port ${PORT} (API + web app)`);
    } else {
      console.log(`\n🚀 EMCY Dashboard API running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health\n`);
      console.log('Default login: admin@emcy.com / admin123\n');
    }
  });
}

start();
