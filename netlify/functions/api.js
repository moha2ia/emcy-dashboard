const serverless = require('serverless-http');
const { app, seedAdmin, seedDemoData } = require('../../server/server');

let handler = null;

// One shared init per isolate: concurrent invocations await the same promise,
// so seeding can never run twice in parallel on a cold start.
let initPromise = null;

function ensureInit() {
  if (!initPromise) {
    initPromise = (async () => {
      await seedAdmin();
      await seedDemoData(); // no-ops in production
    })().catch((err) => {
      initPromise = null; // allow retry on the next invocation
      throw err;
    });
  }
  return initPromise;
}

module.exports.handler = async (event, context) => {
  await ensureInit();
  if (!handler) {
    handler = serverless(app, { binary: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] });
  }
  return handler(event, context);
};
