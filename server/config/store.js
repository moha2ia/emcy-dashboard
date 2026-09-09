/**
 * Storage driver abstraction — the heart of the Netlify port.
 *
 * The app historically read/wrote db.json and uploaded files directly on the
 * local filesystem. That works for `npm run dev` but NOT on Netlify functions,
 * where the filesystem is ephemeral and wiped on every deploy.
 *
 * Two drivers, same interface:
 *  - "fs"    : plain filesystem (local dev). db = server/data/db.json,
 *              uploads = server/uploads/**, backups = server/data/backups/
 *  - "blobs" : Netlify Blobs (production on Netlify). Everything lives in a
 *              blobs store; survives deploys, no external service needed.
 *
 * The driver is chosen automatically: blobs when running inside a Netlify
 * function (NETLIFY env var + BLOBS_CONTEXT available), fs otherwise.
 */
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..');

// Local filesystem layout (defaults, unchanged behaviour for dev)
const DATA_DIR = process.env.EMCY_DATA_DIR || path.join(SERVER_ROOT, 'data');
const UPLOADS_DIR = process.env.EMCY_UPLOADS_DIR || path.join(SERVER_ROOT, 'uploads');

const ON_NETLIFY = Boolean(process.env.NETLIFY) || Boolean(process.env.NETLIFY_BLOBS_CONTEXT);
const DRIVER = process.env.EMCY_STORE_DRIVER || (ON_NETLIFY ? 'blobs' : 'fs');

let blobsCtx = null;
function getBlobs() {
  if (blobsCtx) return blobsCtx;
  // The @netlify/blobs context is injected by the Netlify functions runtime;
  // resolved lazily so the module can load (and be bundled) without it.
  const { getStore } = require('@netlify/blobs');
  blobsCtx = {
    db: getStore({ name: 'emcy-db', consistency: 'strong' }),
    backups: getStore({ name: 'emcy-db-backups' }),
    uploads: getStore({ name: 'emcy-uploads' }),
  };
  return blobsCtx;
}

/* ----------------------------- db adapter ------------------------------ */
/* The adapter owns persistence end-to-end: every write snapshots a backup
 * first, then stores the new state. Routes await their writes, so on Netlify
 * the function stays alive until the data is durably stored. */

function makeDbAdapter(defaultValue = {}) {
  if (DRIVER === 'blobs') {
    return {
      async read() {
        const blobs = getBlobs();
        const raw = await blobs.db.get('db.json');
        if (raw === undefined || raw === null || !raw.trim()) {
          // Mirror lowdb's FileAsync contract: initialise the store with the
          // serialized default so the db state is never null.
          await blobsCtx.db.setJSON('db.json', defaultValue);
          return defaultValue;
        }
        try {
          return JSON.parse(raw);
        } catch (e) {
          e.message = `Malformed JSON in blobs store: db.json — ${e.message}`;
          throw e;
        }
      },
      async write(data) {
        await backupDb(data);
        const blobs = getBlobs();
        await blobs.db.setJSON('db.json', data);
      },
    };
  }
  const DB_FILE = path.join(DATA_DIR, 'db.json');
  return {
    read() {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        if (raw.trim()) return JSON.parse(raw);
      }
      // Missing or empty file: initialise it with the default structure
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    },
    write(data) {
      backupDb(data);
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    },
  };
}

/* ------------------------------- uploads ------------------------------- */
/* Uploads are addressed as "<folder>/<filename>" with folder in {avatars,work} */

async function saveUpload(folder, filename, buffer) {
  const key = `${folder}/${filename}`;
  if (DRIVER === 'blobs') {
    await getBlobs().uploads.set(key, buffer);
  } else {
    const dir = path.join(UPLOADS_DIR, folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), buffer);
  }
  return key;
}

async function readUpload(key) {
  if (!key || key.includes('..')) return null;
  if (DRIVER === 'blobs') {
    return getBlobs().uploads.get(key, { type: 'arrayBuffer' });
  }
  const full = path.join(UPLOADS_DIR, key);
  return fs.existsSync(full) ? fs.readFileSync(full) : null;
}

async function deleteUpload(key) {
  if (!key || key.includes('..')) return;
  if (DRIVER === 'blobs') {
    await getBlobs().uploads.delete(key);
  } else {
    const full = path.join(UPLOADS_DIR, key);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }
}

/* ------------------------------- backups ------------------------------- */

async function backupDb(dbState) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const payload = JSON.stringify(dbState, null, 2);
    if (DRIVER === 'blobs') {
      const blobs = getBlobs();
      await blobs.backups.set(`db-${stamp}.json`, payload);
      const old = await blobs.backups.list();
      const names = (old.blobs || []).map((b) => b.key).filter((k) => k.startsWith('db-') && k.endsWith('.json')).sort();
      while (names.length > 20) {
        await blobs.backups.delete(names.shift());
      }
    } else {
      const BACKUP_DIR = path.join(DATA_DIR, 'backups');
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.writeFileSync(path.join(BACKUP_DIR, `db-${stamp}.json`), payload);
      const names = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db-') && f.endsWith('.json')).sort();
      while (names.length > 20) fs.unlinkSync(path.join(BACKUP_DIR, names.shift()));
    }
  } catch (err) {
    // Never let a backup failure break a request
    console.error('Backup failed:', err.message);
  }
}

module.exports = {
  DRIVER,
  ON_NETLIFY,
  SERVER_ROOT,
  DATA_DIR,
  UPLOADS_DIR,
  makeDbAdapter,
  saveUpload,
  readUpload,
  deleteUpload,
  backupDb,
};
