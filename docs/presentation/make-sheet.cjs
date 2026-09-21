/* Generate a self-contained contact sheet with slides inlined as data URIs. */
const fs = require('fs');
const path = require('path');

const slidesDir = path.join(__dirname, 'slides');
const files = fs.readdirSync(slidesDir).filter((f) => /^Slide\d+\.JPG$/i.test(f)).sort((a, b) => {
  const n = (s) => parseInt(s.replace(/\D/g, ''), 10);
  return n(a) - n(b);
});

const cards = files
  .map((f, i) => {
    const b64 = fs.readFileSync(path.join(slidesDir, f)).toString('base64');
    return `<figure><img src="data:image/jpeg;base64,${b64}" alt="Diapositive ${i + 1}"><figcaption>Diapositive ${i + 1} / ${files.length}</figcaption></figure>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Slides - EMCY Dashboard</title>
<style>
  body { background: #1a2333; margin: 0; padding: 24px; font-family: 'Segoe UI', sans-serif; }
  h1 { color: #fff; font-size: 18px; margin: 0 0 16px; }
  .grid { columns: 2 420px; column-gap: 20px; }
  figure { margin: 0 0 20px; break-inside: avoid; }
  img { width: 100%; border-radius: 6px; box-shadow: 0 4px 18px rgba(0,0,0,.45); display: block; }
  figcaption { color: #9fb3d1; font-size: 12px; padding: 6px 2px; }
</style>
</head>
<body>
<h1>EMCY Dashboard - État d'avancement (16 diapositives)</h1>
<div class="grid">
${cards}
</div>
</body>
</html>`;

const out = path.join(__dirname, 'contact-sheet.html');
fs.writeFileSync(out, html);
console.log('contact sheet written: ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
