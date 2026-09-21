/* Remove all presentation-staged demo data from db.json (run with API stopped). */
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'server', 'data', 'db.json');
const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged-state.json'), 'utf8'));
const DEMO_MEMBER_ID = '09546af8-45a1-4270-a458-a7faa8c8f4c1';

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

const before = {
  users: db.users.length,
  tasks: db.tasks.length,
  workLogs: db.workLogs.length,
};

db.tasks = db.tasks.filter((t) => !state.taskIds.includes(t.id));
db.workLogs = db.workLogs.filter((l) => {
  if (l.userId === DEMO_MEMBER_ID) return false; // all logs staged for the demo member
  if (state.logKeys.some((k) => k.userId === 'admin-self' && k.date === l.date && l.userId === db.users.find((u) => u.role === 'admin')?.id)) return false;
  return true;
});
db.users = db.users.filter((u) => u.id !== DEMO_MEMBER_ID);

const after = {
  users: db.users.length,
  tasks: db.tasks.length,
  workLogs: db.workLogs.length,
};

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log('before:', JSON.stringify(before));
console.log('after: ', JSON.stringify(after));
console.log(
  'removed:',
  before.users - after.users,
  'user(s),',
  before.tasks - after.tasks,
  'task(s),',
  before.workLogs - after.workLogs,
  'log(s)'
);
console.log('resources kept:', db.resources.length);
