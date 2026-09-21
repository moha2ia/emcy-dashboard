/**
 * Function harness - drives the REAL Netlify function handler in-process
 * (plus fresh-process cold starts) against a mocked, file-backed Netlify
 * Blobs store. No network, no real Netlify needed.
 *
 * Run: node server/test/function-harness.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Behave exactly like the Netlify function: blobs driver, no listener.
// MUST be set before requiring the app modules.
process.env.NETLIFY = 'true';
process.env.EMCY_STORE_DRIVER = 'blobs';

delete process.env.JWT_SECRET;
delete process.env.ADMIN_SEED_PASSWORD;

const { installMock, seedRaw, readRaw } = require('./mocks/blobs-mock.cjs');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'emcy-harness-'));
installMock(ROOT);

const { handler } = require(path.join(__dirname, '..', '..', 'netlify', 'functions', 'api'));
// Requiring the app loads server/.env locally (dotenv). Netlify has no such
// file - drop the local secrets so the store-persisted fallback is exercised.
delete process.env.JWT_SECRET;
delete process.env.ADMIN_SEED_PASSWORD;

/* --------------------------- tiny test helpers --------------------------- */

let pass = 0;
let fail = 0;
const failures = [];

function ok(cond, label, extra) {
  if (cond) {
    pass++;
    console.log(`  ${label}`);
  } else {
    fail++;
    failures.push(label + (extra ? ` - ${extra}` : ''));
    console.error(`  ${label}${extra ? ` - ${extra}` : ''}`);
  }
}

function section(title) {
  console.log(`\n ${title} ${''.repeat(Math.max(0, 60 - title.length))}`);
}

const TMP = ROOT;
function eventFile(name, ev) {
  const file = path.join(TMP, name);
  fs.writeFileSync(file, JSON.stringify(ev));
  return file;
}

function apiEvent(method, apiPath, { body, token, contentType } = {}) {
  // Netlify delivers header names lowercased - match that exactly, and always
  // label JSON bodies so express.json() parses them.
  const headers = {};
  if (contentType) headers['content-type'] = contentType;
  else if (body !== undefined && body !== null && !Buffer.isBuffer(body) && typeof body !== 'string') headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let encodedBody = null;
  let isB64 = false;
  if (body !== undefined && body !== null) {
    if (Buffer.isBuffer(body)) {
      encodedBody = body.toString('base64');
      isB64 = true;
    } else if (typeof body === 'string') {
      encodedBody = body;
    } else {
      encodedBody = JSON.stringify(body);
    }
  }
  return {
    resource: '/.netlify/functions/api/{proxy+}',
    path: `/.netlify/functions/api${apiPath}`,
    httpMethod: method,
    headers,
    multiValueHeaders: {},
    queryStringParameters: null,
    isBase64Encoded: isB64,
    body: encodedBody,
    requestContext: { httpMethod: method, path: `/.netlify/functions/api${apiPath}` },
  };
}

async function call(ev) {
  const res = await handler(ev, {});
  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch {
    json = null;
  }
  return { ...res, json };
}

async function freshColdStart(ev, envPairs = [], rootOverride = ROOT) {
  const out = execFileSync(
    process.execPath,
    [path.join(__dirname, 'cold-start.cjs'), rootOverride, eventFile(`ev-${Date.now()}-${Math.random().toString(36).slice(2)}.json`, ev), ...envPairs.flatMap((p) => ['--env', p])],
    { encoding: 'utf-8', timeout: 60000 }
  );
  const line = out.trim().split('\n').pop();
  return JSON.parse(line);
}

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
function makeZipBuffer(n = 2048) {
  const payload = Buffer.alloc(n);
  for (let i = 0; i < n; i++) payload[i] = i % 256;
  return Buffer.concat([ZIP_MAGIC, payload.slice(4)]);
}

function multipart(fields, fileField, fileName, fileBuf, mime) {
  const boundary = '----emcyharness' + Date.now() + Math.random().toString(36).slice(2);
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      )
    );
  }
  parts.push(
    Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`
      ),
      fileBuf,
      Buffer.from('\r\n'),
    ])
  );
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

/* ------------------------------- the tests ------------------------------- */

(async () => {
  /* 1. Path shapes: rewritten AND doubled-prefix must both return JSON */
  section('1. Path normalization (Netlify rewrite + doubled prefix)');
  const doubled = await call(apiEvent('GET', '/.netlify/functions/api/api/health'.replace('/.netlify/functions/api', '/.netlify/functions/api') + ''));
  // The truly doubled shape:
  const doubled2 = await call({
    ...apiEvent('GET', '/api/health'),
    path: '/.netlify/functions/api/api/health',
    requestContext: { httpMethod: 'GET', path: '/.netlify/functions/api/api/health' },
  });
  ok(doubled2.statusCode === 200, 'doubled-prefix /.netlify/functions/api/api/health returns 200', `got ${doubled2.statusCode}`);
  ok(doubled2.json && doubled2.json.status === 'ok', 'doubled-prefix returns JSON health payload', JSON.stringify(doubled2.json));
  const rewritten = await call(apiEvent('GET', '/api/health'));
  ok(rewritten.statusCode === 200, 'rewritten path /api/health returns 200', `got ${rewritten.statusCode}`);
  ok(rewritten.json && rewritten.json.store === 'blobs', 'health reports store driver "blobs"', JSON.stringify(rewritten.json));
  ok(rewritten.json && rewritten.json.db === 'ready', 'health reports db "ready"', JSON.stringify(rewritten.json));

  /* 2. Login with and without ADMIN_SEED_PASSWORD / JWT_SECRET */
  section('2. Login (cold start, env-only secret)');
  const loginNoPass = await call(apiEvent('POST', '/api/auth/login', { body: { email: 'admin@emcy.com', password: 'admin123' } }));
  ok(loginNoPass.statusCode === 200, 'admin/admin123 login works (dev default)', `got ${loginNoPass.statusCode} ${loginNoPass.body && loginNoPass.body.slice(0, 120)}`);
  const adminToken = loginNoPass.json && loginNoPass.json.token;
  ok(!!adminToken, 'login returns a token');
  const badLogin = await call(apiEvent('POST', '/api/auth/login', { body: { email: 'admin@emcy.com', password: 'wrong' } }));
  ok(badLogin.statusCode === 401, 'wrong password is rejected 401', `got ${badLogin.statusCode}`);

  section('2b. JWT_SECRET fallback (no env secret, store-persisted)');
  // ensureJwtSecret already ran during init without JWT_SECRET set - verify it
  // persisted one and that login still works (i.e. sign/verify agree).
  const cfgRaw = readRaw(ROOT, 'emcy-db', 'db/config.json');
  ok(!!cfgRaw && JSON.parse(cfgRaw).jwtSecret, 'generated JWT secret persisted in store config');

  /* 3. Register member, create task for them, member completes it */
  section('3. Full workflow: register → task → complete');
  const reg = await call(apiEvent('POST', '/api/auth/register', {
    token: adminToken,
    body: { name: 'Test Member', email: 'test.member@emcy.ma', password: 'secret1', role: 'member', project: 'QA' },
  }));
  ok(reg.statusCode === 201, 'admin registers member (201)', `got ${reg.statusCode} ${reg.body && reg.body.slice(0, 120)}`);
  const memberLogin = await call(apiEvent('POST', '/api/auth/login', { body: { email: 'test.member@emcy.ma', password: 'secret1' } }));
  ok(memberLogin.statusCode === 200, 'member can log in', `got ${memberLogin.statusCode}`);
  const memberToken = memberLogin.json && memberLogin.json.token;
  const usersList = await call(apiEvent('GET', '/api/users', { token: adminToken }));
  const memberUser = usersList.json.users.find((u) => u.email === 'test.member@emcy.ma');
  ok(!!memberUser, 'member appears in users list');
  const task = await call(apiEvent('POST', '/api/tasks', { token: adminToken, body: { title: 'Harness task', assignedTo: memberUser.id } }));
  ok(task.statusCode === 201, 'admin creates task (201)', `got ${task.statusCode} ${task.body && task.body.slice(0, 120)}`);
  const done = await call(apiEvent('PUT', `/api/tasks/${task.json.task.id}/complete`, { token: memberToken, body: { note: 'done via harness', workLink: '' } }));
  ok(done.statusCode === 200, 'member completes task', `got ${done.statusCode}`);

  /* 4. ZIP resource upload + byte-identical download */
  section('4. Resource upload/download integrity (zip + pdf binary handling)');
  const zipBuf = makeZipBuffer(4096);
  const mp = multipart({ title: 'Harness ZIP', description: '', category: 'Test' }, 'file', 'harness.zip', zipBuf, 'application/zip');
  const up = await call(apiEvent('POST', '/api/resources/upload', { token: adminToken, body: mp.body, contentType: mp.contentType }));
  ok(up.statusCode === 201, 'zip resource uploads (201)', `got ${up.statusCode} ${up.body && up.body.slice(0, 160)}`);
  const filePath = up.json && up.json.resource && up.json.resource.filePath;
  ok(!!filePath, 'upload returns filePath', JSON.stringify(up.json));
  const dl = await call(apiEvent('GET', filePath, {}));
  ok(dl.statusCode === 200, 'resource downloads (200)', `got ${dl.statusCode}`);
  ok(dl.isBase64Encoded === true, 'binary response is base64-encoded (serverless binary path)');
  const decoded = Buffer.from(dl.body, 'base64');
  ok(decoded.equals(zipBuf), 'downloaded bytes are identical to uploaded bytes', `len ${decoded.length} vs ${zipBuf.length}`);
  ok((dl.headers && (dl.headers['Content-Type'] || dl.headers['content-type'])) === 'application/zip', 'zip content-type set', JSON.stringify(dl.headers));

  /* 5. Concurrency: 20 parallel writes across collections - no lost updates */
  section('5. Concurrent writes (20 parallel, mixed collections)');
  const writes = [];
  for (let i = 0; i < 10; i++) {
    writes.push(call(apiEvent('POST', '/api/tasks', { token: adminToken, body: { title: `Concurrent task ${i}`, assignedTo: memberUser.id } })));
    writes.push(call(apiEvent('POST', '/api/resources', { token: adminToken, body: { title: `Concurrent link ${i}`, url: `https://example.com/${i}` } })));
  }
  const results = await Promise.all(writes);
  const allOk = results.every((r) => r.statusCode === 201);
  ok(allOk, 'all 20 concurrent writes return 201', `statuses: ${results.map((r) => r.statusCode).join(',')}`);
  const dbAfter = JSON.parse(readRaw(ROOT, 'emcy-db', 'db/tasks.json'));
  const resAfter = JSON.parse(readRaw(ROOT, 'emcy-db', 'db/resources.json'));
  const concTasks = dbAfter.filter((t) => String(t.title).startsWith('Concurrent task')).length;
  const concRes = resAfter.filter((r) => String(r.title).startsWith('Concurrent link')).length;
  ok(concTasks === 10, 'all 10 concurrent tasks persisted', `found ${concTasks}`);
  ok(concRes === 10, 'all 10 concurrent resources persisted', `found ${concRes}`);

  /* 6. Legacy migration: pre-seed old monolith on a FRESH store, cold start
   *     must split it into shards without losing data. */
  section('6. Legacy db.json migration (cold start, data preserved)');
  const LEGACY_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'emcy-harness-legacy-'));
  const legacyUsers = [
    { id: 'legacy-owner', name: 'Legacy Owner', email: 'admin@emcy.com', password: '$2a$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456', role: 'admin', project: 'EMCY Management', avatar: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'legacy-member', name: 'Legacy Member', email: 'member@emcy.ma', password: '$2a$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456', role: 'member', project: 'Ops', avatar: null, createdAt: '2026-01-01T00:00:00.000Z' },
  ];
  seedRaw(LEGACY_ROOT, 'emcy-db', 'db.json', { users: legacyUsers, weeklyProgress: [], workLogs: [], tasks: [], resources: [{ id: 'legacy-res', type: 'link', title: 'Legacy link', url: 'https://legacy.example' }] });
  const legacyHealth = await freshColdStart(apiEvent('GET', '/api/health'), ['NODE_ENV=production', 'EMCY_STORE_DRIVER=blobs'], LEGACY_ROOT);
  ok(legacyHealth.statusCode === 200, 'cold start after legacy seed healthy', JSON.stringify(legacyHealth.body));
  const legacyShards = JSON.parse(readRaw(LEGACY_ROOT, 'emcy-db', 'db/users.json'));
  ok(Array.isArray(legacyShards) && legacyShards.some((u) => u.id === 'legacy-member'), 'legacy users migrated into shards');
  const legacyRes = JSON.parse(readRaw(LEGACY_ROOT, 'emcy-db', 'db/resources.json'));
  ok(legacyRes.some((r) => r.id === 'legacy-res'), 'legacy resources migrated into shards');
  const metaRaw = readRaw(LEGACY_ROOT, 'emcy-db', 'db/meta.json');
  ok(!!metaRaw && JSON.parse(metaRaw).legacyMigrated === true, 'migration flag recorded in meta');
  // Legacy login: the seeded hash is fake, so login won't succeed - but the
  // admin lookup must exist and login must fail ONLY on password (401), not 500.
  const legacyLogin = await freshColdStart(
    apiEvent('POST', '/api/auth/login', { body: { email: 'admin@emcy.com', password: 'whatever' } }),
    ['NODE_ENV=production', 'EMCY_STORE_DRIVER=blobs'],
    LEGACY_ROOT
  );
  ok(legacyLogin.statusCode === 401, 'legacy owner login fails cleanly at password check (401, not 500)', `got ${legacyLogin.statusCode}`);

  /* 7. Malformed shard recovery from backups */
  section('7. Malformed shard → backup recovery');
  const beforeUsers = JSON.parse(readRaw(ROOT, 'emcy-db', 'db/users.json'));
  // A write happened during cold start #2 (seeding/repair), so a backup snapshot exists.
  const backups = fs.readdirSync(path.join(ROOT, 'emcy-db-backups')).filter((f) => f.startsWith('db-'));
  ok(backups.length > 0, 'backup snapshots exist', `count ${backups.length}`);
  fs.writeFileSync(path.join(ROOT, 'emcy-db', encodeURIComponent('db/users.json')), '{ this is not json');
  const healthAfterCorrupt = await freshColdStart(apiEvent('GET', '/api/health'), ['NODE_ENV=production', 'EMCY_STORE_DRIVER=blobs']);
  ok(healthAfterCorrupt.statusCode === 200, 'health OK after corrupting users shard', JSON.stringify(healthAfterCorrupt.body));
  const recovered = JSON.parse(readRaw(ROOT, 'emcy-db', 'db/users.json'));
  ok(Array.isArray(recovered) && recovered.length === beforeUsers.length, 'users shard recovered from backup', `recovered ${recovered && recovered.length}, expected ${beforeUsers.length}`);

  /* 8. Double cold start → exactly one admin (idempotent seeding) */
  section('8. Double cold start → exactly one owner (prod, ADMIN_SEED_PASSWORD set)');
  seedRaw(ROOT, 'emcy-db', 'db/meta.json', { legacyMigrated: true });
  const c1 = await freshColdStart(apiEvent('GET', '/api/health'), ['NODE_ENV=production', 'EMCY_STORE_DRIVER=blobs', 'ADMIN_SEED_PASSWORD=staging-pass-1']);
  const c2 = await freshColdStart(apiEvent('GET', '/api/health'), ['NODE_ENV=production', 'EMCY_STORE_DRIVER=blobs', 'ADMIN_SEED_PASSWORD=staging-pass-1']);
  ok(c1.statusCode === 200 && c2.statusCode === 200, 'two consecutive cold starts healthy');
  const adminsAfter = JSON.parse(readRaw(ROOT, 'emcy-db', 'db/users.json')).filter((u) => u.role === 'admin' && u.email === 'admin@emcy.com');
  ok(adminsAfter.length === 1, 'exactly one owner after double cold start', `found ${adminsAfter.length}`);
  // Login with the env-provided password (repair path may have upgraded it)
  const prodLogin = await freshColdStart(
    apiEvent('POST', '/api/auth/login', { body: { email: 'admin@emcy.com', password: 'staging-pass-1' } }),
    ['NODE_ENV=production', 'EMCY_STORE_DRIVER=blobs', 'ADMIN_SEED_PASSWORD=staging-pass-1']
  );
  ok(prodLogin.statusCode === 200, 'prod login works with ADMIN_SEED_PASSWORD', `got ${prodLogin.statusCode} ${prodLogin.body && prodLogin.body.slice(0, 120)}`);

  /* 9. Missing JWT_SECRET in a fresh environment - login still works */
  section('9. JWT_SECRET fallback across cold starts (no env secret)');
  // The in-process isolate generated one in step 2b; fresh processes must use
  // the SAME persisted secret (or set env). Verify a token from the in-process
  // isolate still verifies in a fresh process with NO env secret.
  const check = await freshColdStart(
    apiEvent('GET', '/api/auth/me', { token: adminToken }),
    ['NODE_ENV=production', 'EMCY_STORE_DRIVER=blobs']
  );
  ok(check.statusCode === 200, 'token from isolate A verifies in isolate B without env secret', `got ${check.statusCode}`);

  /* Summary */
  console.log('\n════════════════════════════════════════');
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('  Failures:');
    failures.forEach((f) => console.log(`   - ${f}`));
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('HARNESS CRASH:', e && e.stack ? e.stack : e);
  process.exit(1);
});
