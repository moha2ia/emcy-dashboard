/* Capture authenticated screenshots of every page with headless Chrome. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const OUT = path.join(__dirname, 'shots');
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged-state.json'), 'utf8'));
const DEMO_MEMBER_ID = '09546af8-45a1-4270-a458-a7faa8c8f4c1';

async function login(page, email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  const res = await page.evaluate(async (email, password) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  }, email, password);
  if (!res.token) throw new Error('login failed: ' + JSON.stringify(res));
  await page.evaluate((token, user) => {
    localStorage.setItem('emcy_token', token);
    localStorage.setItem('emcy_user', JSON.stringify(user));
  }, res.token, res.user);
}

async function shoot(page, route, file, opts = {}) {
  await page.goto(BASE + route, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, opts.wait || 1200));
  if (opts.scroll) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let y = 0;
        const step = () => {
          y += 400;
          window.scrollTo(0, y);
          if (y < document.body.scrollHeight) setTimeout(step, 60);
          else { window.scrollTo(0, 0); setTimeout(resolve, 300); }
        };
        step();
      });
    });
    await new Promise((r) => setTimeout(r, 400));
  }
  await page.screenshot({ path: path.join(OUT, file) });
  console.log('shot:', file);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-device-scale-factor=2'],
  });

  try {
    // ---------- Desktop admin pass ----------
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await login(page, 'admin@emcy.com', 'admin123');

    await shoot(page, '/', '01-dashboard.png', { wait: 1800, scroll: true });
    await shoot(page, '/tracker', '02-tracker.png', { scroll: true });
    await shoot(page, '/members', '03-members.png', { scroll: true });
    await shoot(page, '/ranking', '04-ranking.png');
    await shoot(page, '/calendar', '05-calendar.png', { wait: 1600 });
    await shoot(page, '/resources', '06-resources.png', { scroll: true });
    await shoot(page, '/profile', '07-profile.png');
    await shoot(page, '/task', '08-task-admin.png');

    // ---------- Mobile admin pass (responsive proof) ----------
    const mob = await browser.newPage();
    await mob.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    await login(mob, 'admin@emcy.com', 'admin123');
    await shoot(mob, '/', '09-mobile-dashboard.png', { wait: 1600 });
    await mob.close();

    // ---------- Member pass (member view of his tasks) ----------
    const mp = await browser.newPage();
    await mp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await login(mp, 'demo.membre@emcy.ma', 'demo123');
    await shoot(mp, '/task', '10-task-member.png');
    await mp.close();

    console.log('All screenshots done.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
