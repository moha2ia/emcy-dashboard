const low = require('lowdb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('./store');

const DEFAULTS = {
  users: [],
  weeklyProgress: [],
  workLogs: [],
  tasks: [],
};

// With an async adapter (Netlify Blobs), low() resolves AFTER the first read,
// so the db instance is only safe to touch once dbReady has resolved. The
// `db` export is a getter: route modules capture it at load time but always
// dereference it per-request, which is after the handler awaited dbReady.
const state = { db: null };

const dbReady = (async () => {
  // The adapter snapshots a backup before every write (see store.js), so
  // any bad write can be rolled back from data/backups or the blobs store.
  const instance = await Promise.resolve(low(store.makeDbAdapter(DEFAULTS)));

  state.db = instance;
  return instance;
})();

/**
 * Seed a default admin user if none exists
 */
async function seedAdmin() {
  const db = await dbReady;
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

    await db.get('users').push(admin).write();
    console.log(`✅ Default admin seeded: admin@emcy.com / ${initialPassword}`);
  } else if (
    process.env.ADMIN_SEED_PASSWORD &&
    process.env.NODE_ENV === 'production' &&
    (await bcrypt.compare('admin123', adminExists.password))
  ) {
    // Repair path: an earlier deploy seeded the owner with the well-known
    // default before ADMIN_SEED_PASSWORD existed (the database persists
    // across deploys). Upgrade it once — only fires while the password is
    // still the default, so a deliberately chosen password is never touched.
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(process.env.ADMIN_SEED_PASSWORD, salt);
    await db.get('users').find({ id: adminExists.id }).assign({ password: hashed }).write();
    console.log('🔐 Owner password upgraded from the default to ADMIN_SEED_PASSWORD.');
  }
}

/**
 * Seed demo members for local testing. Never runs in production — the live
 * dashboard must not start with six fake accounts.
 */
async function seedDemoData() {
  if (process.env.NODE_ENV === 'production') return;
  const db = await dbReady;

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
      await db.get('users').push(user).write();
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
        await db.get('weeklyProgress').push(progress).write();
      }
    }

    console.log(`✅ Seeded ${demoMembers.length} demo members with 8 weeks of progress data`);
  }
}

module.exports = {
  // Routes must call getDb() per request (after awaiting dbReady) — destructuring
  // `db` at module-load time would capture the value before initialization.
  getDb() {
    return state.db;
  },
  get db() {
    return state.db;
  },
  dbReady,
  seedAdmin,
  seedDemoData,
};
