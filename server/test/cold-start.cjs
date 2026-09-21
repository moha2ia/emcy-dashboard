/**
 * Cold-start runner: boots the Netlify function handler in a FRESH node
 * process against the same store dir, invokes it once, prints the response,
 * exits. Lets the harness simulate real Netlify cold starts (new isolate,
 * persistent storage).
 *
 * Usage:
 *   node cold-start.cjs <storeRoot> <jsonEventFile> [--env K=V ...]
 * Prints the JSON response envelope to stdout.
 */
const path = require('path');
const fs = require('fs');

const storeRoot = process.argv[2];
const eventFile = process.argv[3];
if (!storeRoot || !eventFile) {
  console.error('usage: node cold-start.cjs <storeRoot> <eventJsonFile> [--env K=V ...]');
  process.exit(64);
}

// Parse --env K=V pairs (all must come after the two positional args)
const envPairs = process.argv.slice(4);
for (let i = 0; i < envPairs.length; i++) {
  if (envPairs[i] === '--env') {
    const [k, v] = envPairs[i + 1].split('=');
    process.env[k] = v;
    i++;
  }
}

const { installMock } = require('./mocks/blobs-mock.cjs');
installMock(path.resolve(storeRoot));

const { handler } = require(path.join(__dirname, '..', '..', 'netlify', 'functions', 'api'));
// On Netlify there is no server/.env - but locally dotenv loads it into env.
// Drop the local secret so the JWT_SECRET fallback path is exercised exactly
// as it would be in production.
delete process.env.JWT_SECRET;
const event = JSON.parse(fs.readFileSync(eventFile, 'utf-8'));

handler(event, {})
  .then((res) => {
    process.stdout.write(JSON.stringify(res));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
