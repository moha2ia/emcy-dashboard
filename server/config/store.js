/**
 * Storage driver abstraction - the heart of the serverless port.
 *
 * Two drivers, same interface:
 *  - "fs"    : plain filesystem (local dev). db = server/data/db.json,
 *              uploads = server/uploads/**, backups = server/data/backups/
 *  - "blobs" : Netlify Blobs (production on Netlify). Everything lives in a
 *              blobs store; survives deploys, no external service needed.
 *
 * The driver is chosen automatically: blobs when running inside a Netlify
 * function (NETLIFY env var / BLOBS_CONTEXT available), fs otherwise.
 *
 * ----------------------- Sharded database (blobs) -----------------------
 * The database is stored as one blob key per collection:
 *
 *     db/users.json  db/tasks.json  db/workLogs.json
 *     db/weeklyProgress.json  db/resources.json  db/meta.json
 *
 * Why shards instead of a single db.json blob:
 *  - Netlify functions run many isolates concurrently. A whole-file rewrite
 *    from two isolates at once silently drops one side's changes (lost
 *    updates -> "users disappear, tokens stop working"). With shards,
 *    simultaneous writes to DIFFERENT collections can no longer clobber
 *    each other; same-collection races are additionally serialized by a
 *    per-isolate write queue and last-write-wins across isolates.
 *  - Writes skip collections that did not change, so a task update no
 *    longer rewrites the (potentially large) users blob.
 *
 * Legacy migration is automatic: on first read, if the old monolithic
 * `db.json` key exists it is split into shards (data preserved), recorded
 * in meta, and removed. Idempotent - safe to re-run.
 *
 * A sharded snapshot (all collections, plus the legacy file pre-migration)
 * is written to the backups store before every write batch, so any state
 * can be restored from `emcy-db-backups`.
 */
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..');

// Local filesystem layout (defaults, unchanged behaviour for dev)
const DATA_DIR = process.env.EMCY_DATA_DIR || path.join(SERVER_ROOT, 'data');
const UPLOADS_DIR = process.env.EMCY_UPLOADS_DIR || path.join(SERVER_ROOT, 'uploads');

const ON_NETLIFY = Boolean(process.env.NETLIFY) || Boolean(process.env.NETLIFY_BLOBS_CONTEXT);
const DRIVER = process.env.EMCY_STORE_DRIVER || (ON_NETLIFY ? 'blobs' : 'fs');

// The collections that make up the database, in canonical order.
const COLLECTIONS = ['users', 'weeklyProgress', 'workLogs', 'tasks', 'resources'];

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

/* ------------------------------ meta store ------------------------------ */

const META_KEY = 'db/meta.json';

async function readMeta() {
  const raw = await getBlobs().db.get(META_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeMeta(meta) {
  await getBlobs().db.setJSON(META_KEY, meta);
}

/* --------------------------- snapshot backups --------------------------- */

async function writeBackupSnapshot(payload) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blobs = getBlobs();
    await blobs.backups.set(`db-${stamp}.json`, JSON.stringify(payload));
    const old = await blobs.backups.list();
    const names = (old.blobs || [])
      .map((b) => b.key)
      .filter((k) => k.startsWith('db-') && k.endsWith('.json'))
      .sort();
    while (names.length > 20) {
      await blobs.backups.delete(names.shift());
    }
  } catch (err) {
    // Never let a backup failure break a request
    console.error('Backup failed:', err.message);
  }
}

/* ------------------------------ db adapter ------------------------------ */
/* The adapter owns persistence end-to-end: every write snapshots a backup
 * first, then stores the new state. Writes are serialized through a queue
 * so concurrent requests on the same isolate can't interleave reads and
 * writes of the same collection. Routes await their writes, so on Netlify
 * the function stays alive until the data is durably stored. */

function makeDbAdapter(defaultValue = {}) {
  if (DRIVER === 'blobs') {
    // Serialized write chain: each .write() awaits the previous one.
    let writeQueue = Promise.resolve();
    // Per-collection caches of the last written state - used to skip
    // redundant blob writes when a write batch touches only some shards.
    let lastWritten = null;

    async function readShard(name) {
      const key = `db/${name}.json`;
      const raw = await getBlobs().db.get(key);
      if (raw === undefined || raw === null || !String(raw).trim()) return [];
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error(`[store] Shard db/${name}.json is malformed - attempting backup recovery.`);
        const recovered = await recoverShardFromBackup(name);
        if (recovered !== null) return recovered;
        e.message = `Malformed JSON in blobs store: ${key} - ${e.message}`;
        throw e;
      }
    }

    async function writeShard(name, value) {
      await getBlobs().db.setJSON(`db/${name}.json`, value);
    }

    /** Restore a broken shard from the newest backup snapshot that parses. */
    async function recoverShardFromBackup(name) {
      try {
        const blobs = getBlobs();
        const list = await blobs.backups.list();
        const names = (list.blobs || [])
          .map((b) => b.key)
          .filter((k) => k.startsWith('db-') && k.endsWith('.json'))
          .sort()
          .reverse();
        for (const backupKey of names) {
          const raw = await blobs.backups.get(backupKey);
          if (!raw) continue;
          try {
            const snap = JSON.parse(raw);
            if (snap && Array.isArray(snap[name])) {
              console.error(`[store] Recovered db/${name}.json from backup ${backupKey}.`);
              await writeShard(name, snap[name]);
              return snap[name];
            }
          } catch {
            // Skip unreadable snapshots, try the next (older) one.
          }
        }
      } catch (err) {
        console.error('[store] Backup recovery failed:', err.message);
      }
      return null;
    }

    /** One-time legacy migration: split monolithic db.json into shards. */
    async function migrateLegacyDb() {
      const meta = await readMeta();
      if (meta.legacyMigrated) return;

      const raw = await getBlobs().db.get('db.json');
      if (raw) {
        const legacy = JSON.parse(raw); // throws -> surfaced loudly, nothing lost
        // Preserve the pre-migration monolith in the backups store.
        await writeBackupSnapshot(legacy);
        for (const name of COLLECTIONS) {
          const value = Array.isArray(legacy[name]) ? legacy[name] : [];
          await writeShard(name, value);
        }
        console.log('[store] Migrated legacy db.json into per-collection shards.');
      }
      await writeMeta({ ...meta, legacyMigrated: true });
    }

    // lowdb mutates its state objects IN PLACE, so the snapshot used for
    // change detection must be a deep clone - comparing the live object
    // against itself would mark every shard "unchanged" and skip all writes.
    const cloneState = (s) => JSON.parse(JSON.stringify(s));

    async function readAll() {
      await migrateLegacyDb();
      const state = {};
      for (const name of COLLECTIONS) {
        state[name] = await readShard(name);
      }
      lastWritten = cloneState(state);
      return state;
    }

    async function writeAll(data) {
      // Snapshot before mutating (best-effort, never throws).
      if (lastWritten) {
        await writeBackupSnapshot(lastWritten);
      } else {
        await writeBackupSnapshot(data);
      }

      const prev = lastWritten || {};
      for (const name of COLLECTIONS) {
        const value = Array.isArray(data[name]) ? data[name] : [];
        // Skip shards that did not change - fewer blob writes, fewer races.
        if (prev[name] && JSON.stringify(prev[name]) === JSON.stringify(value)) continue;
        await writeShard(name, value);
      }

      const next = {};
      for (const name of COLLECTIONS) next[name] = data[name];
      lastWritten = cloneState(next);
    }

    return {
      async read() {
        return readAll();
      },
      write(data) {
        // Serialize writes through the queue; re-throw the first failure.
        const run = writeQueue.then(() => writeAll(data));
        writeQueue = run.catch(() => {});
        return run;
      },
    };
  }

  // fs driver
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
/* Uploads are addressed as "<folder>/<filename>" with folder in {avatars,work,resources} */

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
  if (DRIVER === 'blobs') {
    // Already snapshotted inside the blobs adapter write path.
    return;
  }
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const payload = JSON.stringify(dbState, null, 2);
    const BACKUP_DIR = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(path.join(BACKUP_DIR, `db-${stamp}.json`), payload);
    const names = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db-') && f.endsWith('.json')).sort();
    while (names.length > 20) fs.unlinkSync(path.join(BACKUP_DIR, names.shift()));
  } catch (err) {
    // Never let a backup failure break a request
    console.error('Backup failed:', err.message);
  }
}

/* --------------------------- config persistence ------------------------- */
/* Secrets that must be identical across all serverless isolates (e.g. a
 * generated JWT_SECRET fallback) are stored in a dedicated blobs key, read
 * back on boot. On the fs driver a small JSON file in DATA_DIR plays the
 * same role. Exposed as getConfigValue/setConfigValue. */

const CONFIG_FS_FILE = path.join(DATA_DIR, 'config.json');

async function getConfigValue(name) {
  if (DRIVER === 'blobs') {
    const raw = await getBlobs().db.get('db/config.json');
    if (!raw) return undefined;
    try {
      return JSON.parse(raw)[name];
    } catch {
      return undefined;
    }
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FS_FILE, 'utf-8'));
    return cfg[name];
  } catch {
    return undefined;
  }
}

async function setConfigValue(name, value) {
  if (DRIVER === 'blobs') {
    const raw = await getBlobs().db.get('db/config.json');
    let cfg = {};
    if (raw) {
      try {
        cfg = JSON.parse(raw);
      } catch {
        cfg = {};
      }
    }
    cfg[name] = value;
    await getBlobs().db.setJSON('db/config.json', cfg);
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_FS_FILE, 'utf-8'));
  } catch {
    cfg = {};
  }
  cfg[name] = value;
  fs.writeFileSync(CONFIG_FS_FILE, JSON.stringify(cfg, null, 2));
}

module.exports = {
  DRIVER,
  ON_NETLIFY,
  SERVER_ROOT,
  DATA_DIR,
  UPLOADS_DIR,
  COLLECTIONS,
  makeDbAdapter,
  saveUpload,
  readUpload,
  deleteUpload,
  backupDb,
  getConfigValue,
  setConfigValue,
};
