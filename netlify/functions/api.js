const serverless = require('serverless-http');
const {
  app,
  seedAdmin,
  seedDemoData,
  ensureJwtSecret,
  repairDuplicates,
  dbReady,
} = require('../../server/server');
const { DRIVER } = require('../../server/config/store');

let handler = null;

// One shared init per isolate: concurrent invocations await the same promise,
// so seeding can never run twice in parallel on a cold start.
let initPromise = null;
let initStage = 'not started';

function ensureInit() {
  if (!initPromise) {
    initPromise = (async () => {
      initStage = 'storage adapter';
      await dbReady; // run legacy blob migration before anything touches the db
      initStage = 'jwt secret';
      await ensureJwtSecret();
      initStage = 'seed admin';
      await seedAdmin();
      initStage = 'seed demo';
      await seedDemoData(); // no-ops in production
      initStage = 'repair duplicates';
      await repairDuplicates();
      initStage = 'ready';
      console.log(`[init] Function ready (store: ${DRIVER}).`);
    })().catch((err) => {
      initPromise = null; // allow retry on the next invocation
      initStage = 'failed';
      console.error(`[init] Failed during ${initStage}:`, err && err.stack ? err.stack : err);
      throw err;
    });
  }
  return initPromise;
}

module.exports.handler = async (event, context) => {
  try {
    await ensureInit();
  } catch (err) {
    // Return a structured 500 so the client sees JSON, not a function crash.
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Server initialization failed.',
        stage: initStage,
        hint: 'Check the Netlify function logs for the full stack trace.',
      }),
    };
  }

  if (!handler) {
    handler = serverless(app, {
      binary: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
      ],
    });
  }
  return handler(event, context);
};
