const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { backupDb } = require('./backup');
const { DATA_DIR, DB_FILE } = require('./paths');

// The data directory may point at a mounted disk in deployment — ensure it exists
fs.mkdirSync(DATA_DIR, { recursive: true });

const adapter = new FileSync(DB_FILE);
const db = low(adapter);

// Snapshot db.json before every write so any bad write can be rolled back
const originalWrite = db.write.bind(db);
db.write = (...args) => {
  backupDb();
  return originalWrite(...args);
};

// Set default database structure
db.defaults({
  users: [],
  weeklyProgress: [],
  workLogs: [],
  tasks: [],
}).write();

/**
 * Seed a default admin user if none exists
 */
async function seedAdmin() {
  const adminExists = db.get('users').find({ role: 'admin' }).value();

  if (!adminExists) {
    const salt = await bcrypt.genSalt(10);
    // In production the initial password comes from the environment so the
    // well-known default never ships to a public URL.
    const initialPassword = process.env.ADMIN_SEED_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(initialPassword, salt);

    const admin = {
      id: uuidv4(),
      name: 'Admin EMCY',
      email: 'admin@emcy.com',
      password: hashedPassword,
      role: 'admin',
      project: 'EMCY Management',
      avatar: null,
      createdAt: new Date().toISOString(),
    };

    db.get('users').push(admin).write();
    console.log(`✅ Default admin seeded: admin@emcy.com / ${initialPassword}`);
  }
}

/**
 * Seed demo members for local testing. Never runs in production — the live
 * dashboard must not start with six fake accounts.
 */
async function seedDemoData() {
  if (process.env.NODE_ENV === 'production') return;
  const memberCount = db.get('users').filter({ role: 'member' }).size().value();

  if (memberCount === 0) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('member123', salt);

    const demoMembers = [
      { name: 'Yassine El Amrani', email: 'yassine@emcy.com', project: 'Web Development' },
      { name: 'Sara Benali', email: 'sara@emcy.com', project: 'Marketing' },
      { name: 'Karim Tazi', email: 'karim@emcy.com', project: 'Design' },
      { name: 'Fatima Zahra Idrissi', email: 'fatima@emcy.com', project: 'Content Creation' },
      { name: 'Amine Rachidi', email: 'amine@emcy.com', project: 'Web Development' },
      { name: 'Nadia Ouazzani', email: 'nadia@emcy.com', project: 'Events' },
    ];

    for (const member of demoMembers) {
      const user = {
        id: uuidv4(),
        name: member.name,
        email: member.email,
        password: hashedPassword,
        role: 'member',
        project: member.project,
        avatar: null,
        createdAt: new Date().toISOString(),
      };
      db.get('users').push(user).write();
    }

    // Seed some weekly progress data (last 8 weeks)
    const members = db.get('users').filter({ role: 'member' }).value();
    const statuses = ['done', 'done', 'done', 'not_done', 'done']; // 80% done rate base

    for (const member of members) {
      for (let week = 1; week <= 8; week++) {
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const progress = {
          id: uuidv4(),
          userId: member.id,
          weekNumber: week,
          status: randomStatus,
          date: new Date(2026, 0, week * 7).toISOString(),
          note: '',
          createdAt: new Date().toISOString(),
        };
        db.get('weeklyProgress').push(progress).write();
      }
    }

    console.log(`✅ Seeded ${demoMembers.length} demo members with 8 weeks of progress data`);
  }
}

module.exports = { db, seedAdmin, seedDemoData };
