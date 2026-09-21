/* Stage removable demo data via the API, then screenshots, then cleanup. */
const fs = require('fs');
const http = require('http');

const API = 'http://localhost:5000';
const TOKEN = fs.readFileSync(__dirname + '/.admin-token', 'utf8').trim();
const DEMO_MEMBER_ID = '09546af8-45a1-4270-a458-a7faa8c8f4c1';
const STATE_FILE = __dirname + '/staged-state.json';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      API + path,
      {
        method,
        headers: {
          Authorization: 'Bearer ' + TOKEN,
          ...(data ? { 'Content-Type': 'application/json' } : {}),
        },
      },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(out) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: out });
          }
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// ISO date N days from today (for deadlines / log dates)
function iso(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 86400000);
  return d.toISOString();
}
function ymd(daysFromNow) {
  return iso(daysFromNow).slice(0, 10);
}

(async () => {
  const state = JSON.parse(fs.existsSync(STATE_FILE) ? fs.readFileSync(STATE_FILE, 'utf8') : '{"taskIds":[],"logKeys":[]}');

  // ---- Tasks (idempotent: reuse if already staged this run-set) ----
  if (state.taskIds.length === 0) {
    const tasks = [
      {
        title: 'Préparer le visuel Instagram de la semaine',
        description: 'Créer un carrousel de 5 slides sur le programme EMC Youth, format 1080x1350, respecter la charte graphique (logo + palette bleue).',
        assignedTo: DEMO_MEMBER_ID,
        deadline: iso(3),
      },
      {
        title: 'Corriger les bugs du formulaire de contact',
        description: "Le champ email n'est pas validé côté client. Ajouter la validation et tester sur mobile.",
        assignedTo: DEMO_MEMBER_ID,
        deadline: iso(6),
      },
      {
        title: 'Rédiger le compte-rendu de la réunion du comité',
        description: 'Compte-rendu de la réunion mensuelle : décisions, actions, responsables. À partager sur le Drive.',
        assignedTo: DEMO_MEMBER_ID,
        deadline: iso(10),
      },
      {
        title: 'Mettre à jour la base des contacts partenaires',
        description: 'Vérifier et compléter les coordonnées des 12 partenaires CMRPI.',
        assignedTo: 'all',
        deadline: iso(14),
      },
    ];
    for (const t of tasks) {
      const r = await req('POST', '/api/tasks', t);
      if (!r.json.task) throw new Error('create task failed: ' + JSON.stringify(r));
      state.taskIds.push(r.json.task.id);
    }
    console.log('created tasks:', state.taskIds.length);

    // Complete two of them with member-style submissions
    await req('PUT', `/api/tasks/${state.taskIds[0]}/complete`, {
      note: 'Visuel terminé et validé par le comité.',
      workLink: 'https://drive.google.com/file/d/emcy-visuel-semaine',
    });
    await req('PUT', `/api/tasks/${state.taskIds[3]}/complete`, {
      note: 'Feuille partagée mise à jour avec les 12 partenaires.',
      workLink: 'https://docs.google.com/spreadsheets/contacts-partenaires',
    });
    console.log('completed: 2 tasks');
  } else {
    console.log('tasks already staged:', state.taskIds.length);
  }

  // ---- Work logs for the past 10 days (mixed done/not_done) ----
  if (state.logKeys.length === 0) {
    const pattern = ['done', 'done', 'not_done', 'done', 'done', 'done', 'not_done', 'done', 'done', 'done'];
    for (let i = 10; i >= 1; i--) {
      const status = pattern[10 - i];
      await req('POST', '/api/logs', {
        date: ymd(-i),
        status,
        userId: DEMO_MEMBER_ID,
        note: status === 'done' ? 'Travail effectué.' : 'Jour de repos.',
      });
      state.logKeys.push({ userId: DEMO_MEMBER_ID, date: ymd(-i) });
    }
    // Two logs for the admin so the calendar has several members filled
    for (const off of [-1, -2]) {
      await req('POST', '/api/logs', { date: ymd(off), status: 'done', userId: 'admin-self', note: 'Coordination.' });
      state.logKeys.push({ userId: 'admin-self', date: ymd(off) });
    }
    console.log('created logs:', state.logKeys.length);
  } else {
    console.log('logs already staged:', state.logKeys.length);
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log('state saved.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
