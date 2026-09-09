/**
 * One-off migration: rewrite every account email to the official pattern
 * firstname.lastname@emcy.ma (matching chaimae.bentaleb@emcy.ma style).
 *
 * Rules:
 *  - The main system admin (admin@emcy.com) is left untouched.
 *  - Name parsing: first token = first name, last token = family name.
 *  - Collisions (two people mapping to the same address, or the address
 *    already taken by another account) get a numeric suffix: name2, name3…
 *  - A dry-run prints the plan; pass --apply to write it.
 *
 * Usage: node scripts/migrate-emails.js [--apply]
 */
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { backupDb } = require('../config/backup');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');
const KEEP_UNTOUCHED = [
  'admin@emcy.com', // main system admin stays per team decision
  'chaimae.bentaleb@emcy.ma', // official admin email (as specified)
  'mohamed.elhasnoui@emcy.ma', // official admin email (as specified)
];
const DOMAIN = 'emcy.ma';

const db = low(new FileSync(DB_FILE));

function slug(part) {
  return part.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function patternEmail(name) {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  const first = slug(tokens[0] || '');
  const last = slug(tokens[tokens.length - 1] || '');
  if (!first || !last) return null;
  return `${first}.${last}@${DOMAIN}`;
}

const apply = process.argv.includes('--apply');
const users = db.get('users').value();

const taken = new Set(users.map((u) => u.email.toLowerCase()));
const plan = [];
const conflicts = [];

for (const user of users) {
  if (KEEP_UNTOUCHED.includes(user.email.toLowerCase())) continue;
  if (user.email.toLowerCase().endsWith(`@${DOMAIN}`) && !user.email.toLowerCase().includes('gmail.com')) {
    // Already on an @emcy.ma address — leave as-is unless it doesn't match the pattern
    const target = patternEmail(user.name);
    if (target && user.email.toLowerCase() === target) continue; // already correct
  }

  const base = patternEmail(user.name);
  if (!base) {
    conflicts.push(`⚠️  Could not derive an email for "${user.name}" (${user.email})`);
    continue;
  }

  let email = base;
  let n = 2;
  // Collision = another account already holds it, or we assigned it in this run
  while (taken.has(email) && email !== user.email.toLowerCase()) {
    email = base.replace(`@${DOMAIN}`, `${n}@${DOMAIN}`);
    n += 1;
  }
  if (email === user.email.toLowerCase()) continue; // nothing to change

  plan.push({ id: user.id, name: user.name, role: user.role, from: user.email, to: email });
  taken.add(email);
}

console.log(`Migration plan — ${plan.length} account(s) to update:\n`);
for (const p of plan) {
  console.log(`  ${p.name} [${p.role}]`);
  console.log(`    ${p.from}  →  ${p.to}\n`);
}
conflicts.forEach((c) => console.log(c));

if (plan.length === 0) {
  console.log('Nothing to do.');
  process.exit(0);
}

if (!apply) {
  console.log('Dry run only. Re-run with --apply to write changes.');
  process.exit(0);
}

backupDb(); // snapshot before touching data
for (const p of plan) {
  db.get('users').find({ id: p.id }).assign({ email: p.to }).write();
}
console.log(`✅ Applied: ${plan.length} email(s) migrated. Backups are in data/backups/.`);
