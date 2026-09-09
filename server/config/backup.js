/**
 * Backups are handled inside config/store.js (works for both the local
 * filesystem and Netlify Blobs). This module re-exports the function so
 * existing imports (scripts/migrate-emails.js) keep working.
 */
const store = require('./store');

const backupDb = store.backupDb;

module.exports = { backupDb };
