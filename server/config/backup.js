const fs = require('fs');
const path = require('path');
const { DB_FILE: DATA_FILE, BACKUP_DIR } = require('./paths');

const MAX_BACKUPS = 20;

/**
 * Copy db.json to data/backups/db-<timestamp>.json.
 * Called before every write via the lowdb adapter mixin so any bad write
 * (or rogue delete) can be rolled back manually.
 */
function backupDb() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `db-${stamp}.json`));

    // Prune older backups beyond MAX_BACKUPS
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('db-') && f.endsWith('.json'))
      .sort();
    while (backups.length > MAX_BACKUPS) {
      fs.unlinkSync(path.join(BACKUP_DIR, backups.shift()));
    }
  } catch (err) {
    // Never let a backup failure break a request
    console.error('Backup failed:', err.message);
  }
}

module.exports = { backupDb, DATA_FILE, BACKUP_DIR };
