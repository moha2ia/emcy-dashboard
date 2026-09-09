/**
 * Single source of truth for where the server stores its files.
 *
 * Defaults keep the historical layout (server/data, server/uploads) so local
 * dev is unchanged. In deployment (e.g. Render) the EMCY_DATA_DIR and
 * EMCY_UPLOADS_DIR env vars point these at a persistent disk mount so the
 * database, backups, and uploaded files survive redeploys.
 */
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..');

const DATA_DIR = process.env.EMCY_DATA_DIR || path.join(SERVER_ROOT, 'data');
const UPLOADS_DIR = process.env.EMCY_UPLOADS_DIR || path.join(SERVER_ROOT, 'uploads');

const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

module.exports = { SERVER_ROOT, DATA_DIR, UPLOADS_DIR, DB_FILE, BACKUP_DIR };
