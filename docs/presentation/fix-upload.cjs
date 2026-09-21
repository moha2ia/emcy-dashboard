/* Replace the mojibake'd PPTX resource with a proper UTF-8 upload (Node fetch/FormData). */
const fs = require('fs');

(async () => {
  const token = fs.readFileSync(__dirname + '/.admin-token', 'utf8').trim();
  const API = 'http://localhost:5000';
  const auth = { Authorization: 'Bearer ' + token };

  // 1. Find + delete the corrupted record (and its stored file)
  const list = await (await fetch(API + '/api/resources', { headers: auth })).json();
  const bad = list.resources.find((r) => r.fileName === 'EMCY-Dashboard_Etat-davancement_FR.pptx');
  if (bad) {
    const del = await fetch(API + '/api/resources/' + bad.id, { method: 'DELETE', headers: auth });
    console.log('deleted corrupted record:', del.status);
  }

  // 2. Re-upload with clean UTF-8 metadata
  const fd = new FormData();
  const buf = fs.readFileSync(__dirname + '/EMCY-Dashboard_Etat-davancement_FR.pptx');
  fd.append('file', new Blob([buf]), 'EMCY-Dashboard_Etat-davancement_FR.pptx');
  fd.append('title', 'Présentation - État d’avancement de l’application (FR)');
  fd.append(
    'description',
    'Support PowerPoint (16 diapositives) : fonctionnement complet de l’application avec captures d’écran - connexion, tableau de bord, tâches, présence, membres, classement et ressources.'
  );
  fd.append('category', 'docs');
  const up = await fetch(API + '/api/resources/upload', { method: 'POST', headers: auth, body: fd });
  const j = await up.json();
  console.log('upload status:', up.status);
  console.log('stored title:', j.resource ? j.resource.title : '(failed: ' + JSON.stringify(j) + ')');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
