/**
 * File-backed mock of @netlify/blobs for the function test harness.
 *
 * Why file-backed: real Netlify Blobs persist across function isolates, so
 * "cold start" scenarios spawn a fresh node process against the SAME store
 * directory. An in-memory Map would silently fake that away.
 *
 * Layout under the store root:
 *   <root>/emcy-db/<encodeURIComponent(key)>
 *   <root>/emcy-db-backups/<encodeURIComponent(key)>
 *   <root>/emcy-uploads/<encodeURIComponent(key)>
 *
 * Values are stored exactly as received (strings or buffers). get() returns
 * strings for string values, Buffers for { type: 'buffer' }, per the real API.
 */
const fs = require('fs');
const path = require('path');

function storeDir(root, name) {
  return path.join(root, name);
}

function keyFile(dir, key) {
  return path.join(dir, encodeURIComponent(key));
}

function makeStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return {
    async get(key, opts = {}) {
      const file = keyFile(dir, key);
      if (!fs.existsSync(file)) return undefined;
      const raw = fs.readFileSync(file);
      if (opts && opts.type === 'arrayBuffer') return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
      if (opts && opts.type === 'buffer') return raw;
      return raw.toString('utf-8');
    },
    async getRaw() {
      throw new Error('getRaw not needed by the app');
    },
    async set(key, value) {
      const file = keyFile(dir, key);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf-8'));
    },
    async setJSON(key, value) {
      await this.set(key, JSON.stringify(value));
    },
    async delete(key) {
      const file = keyFile(dir, key);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
    async list({ prefix = '' } = {}) {
      const out = [];
      if (!fs.existsSync(dir)) return { blobs: [] };
      for (const entry of fs.readdirSync(dir)) {
        const key = decodeURIComponent(entry);
        if (!key.startsWith(prefix)) continue;
        out.push({ key });
      }
      return { blobs: out };
    },
  };
}

/**
 * Swap @netlify/blobs in the require cache BEFORE anything requires it.
 * Must be called before requiring server/config/store.js.
 */
function installMock(root) {
  // Resolve relative to this file's ../.. (= server/) so we find the same
  // package the app resolves.
  const serverRoot = path.join(__dirname, '..');
  let resolved;
  try {
    resolved = require.resolve('@netlify/blobs', { paths: [serverRoot] });
  } catch (e) {
    throw new Error(`@netlify/blobs not resolvable from ${serverRoot}: ${e.message}`);
  }

  const getStore = ({ name }) => {
    if (!name) throw new Error('getStore requires a store name');
    return makeStore(storeDir(root, name));
  };

  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: { getStore },
  };

  return { resolved };
}

/** Direct write helper for pre-seeding scenarios (legacy db.json etc.). */
function seedRaw(root, storeName, key, value) {
  const file = keyFile(storeDir(root, storeName), key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

function readRaw(root, storeName, key) {
  const file = keyFile(storeDir(root, storeName), key);
  if (!fs.existsSync(file)) return undefined;
  return fs.readFileSync(file, 'utf-8');
}

module.exports = { installMock, seedRaw, readRaw };
