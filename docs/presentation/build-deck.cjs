/* Build the French "État d'avancement" PPTX with the captured screenshots. */
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const SHOTS = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'shots', f)).toString('base64');

// ---------- Brand ----------
const C = {
  navy: '1F3A5F',
  blue: '3D6DB5',
  lightblue: 'EAF1FA',
  ink: '22314E',
  gray: '5B6B84',
  line: 'D7E1EC',
  white: 'FFFFFF',
  green: '2E9E6B',
};

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'WIDE';
pptx.author = 'EMCY - Morocco CyberScripts Space';
pptx.title = 'EMCY Dashboard - État d’avancement';

const W = 13.333;
const H = 7.5;

// Screenshot image natural size: 2880x1800 (2x of 1440x900) -> aspect 1.6
function shotDims(maxW, maxH) {
  const aspect = 1440 / 900;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }
  return { w, h };
}

function footer(slide, idx, total) {
  slide.addText(
    [
      { text: 'EMCY Dashboard', options: { bold: true, color: C.blue } },
      { text: '   ·   État d’avancement - ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
    ],
    { x: 0.6, y: H - 0.42, w: 8, h: 0.3, fontSize: 9, color: C.gray }
  );
  slide.addText(`${idx} / ${total}`, { x: W - 1.4, y: H - 0.42, w: 0.8, h: 0.3, fontSize: 9, color: C.gray, align: 'right' });
}

// Slide counter (filled after slides are declared)
const slideRefs = [];
function slide(build) {
  const s = pptx.addSlide();
  build(s);
  slideRefs.push(s);
  return s;
}

function sectionLabel(s, text) {
  s.addText(text.toUpperCase(), {
    x: 0.6, y: 0.35, w: 6, h: 0.3, fontSize: 11, bold: true, color: C.blue, charSpacing: 2,
  });
}

// Standard module slide: title left, bullets left, screenshot right
function moduleSlide(opts) {
  slide((s) => {
    s.background = { color: C.white };
    sectionLabel(s, opts.kicker);
    s.addText(opts.title, { x: 0.55, y: 0.6, w: 5.9, h: 0.75, fontSize: 24, bold: true, color: C.ink });
    s.addText(opts.lead, { x: 0.6, y: 1.38, w: 5.6, h: 0.85, fontSize: 12.5, color: C.gray, italic: true });

    const items = opts.bullets.map((t) => ({ text: t, options: { bullet: { characterCode: '25AA', color: C.blue }, breakLine: true } }));
    s.addText(items, { x: 0.6, y: 2.3, w: 5.7, h: 4.4, fontSize: 13, color: C.ink, lineSpacingMultiple: 1.25, valign: 'top' });

    const d = shotDims(6.6, 5.3);
    const x = W - d.w - 0.55;
    const y = (H - d.h) / 2;
    s.addShape('rect', { x: x - 0.06, y: y - 0.06, w: d.w + 0.12, h: d.h + 0.12, fill: { color: C.white }, line: { color: C.line, width: 1.5 }, shadow: { type: 'outer', blur: 12, offset: 3, angle: 90, color: '8A9BB0', opacity: 0.35 } });
    s.addImage({ data: opts.shot, x, y, w: d.w, h: d.h });
    if (opts.caption) {
      s.addText(opts.caption, { x, y: y + d.h + 0.12, w: d.w, h: 0.3, fontSize: 9.5, color: C.gray, align: 'center', italic: true });
    }
    if (opts.note) s.addNotes(opts.note);
  });
}

/* ================= 1. TITLE ================= */
slide((s) => {
  s.background = { color: C.navy };
  s.addShape('rect', { x: 0, y: 0, w: W, h: 0.18, fill: { color: C.blue } });
  s.addShape('ellipse', { x: W - 4.4, y: -2.2, w: 6.5, h: 6.5, fill: { color: '26496F' }, line: { type: 'none' } });
  s.addShape('ellipse', { x: -1.8, y: H - 2.6, w: 5, h: 5, fill: { color: '26496F' }, line: { type: 'none' } });

  s.addText('EMCY', { x: 0.9, y: 1.15, w: 6, h: 1, fontSize: 44, bold: true, color: C.white, charSpacing: 6 });
  s.addText('Morocco CyberScripts Space - Youth', { x: 0.92, y: 2.02, w: 8, h: 0.4, fontSize: 14, color: 'AEC6E4', charSpacing: 1 });

  s.addText('EMCY Dashboard', { x: 0.9, y: 3.05, w: 11.5, h: 0.95, fontSize: 48, bold: true, color: C.white });
  s.addText('État d’avancement de la plateforme de suivi & gestion', {
    x: 0.9, y: 4.0, w: 10.5, h: 0.5, fontSize: 19, color: 'C9D9EE',
  });

  s.addText(
    [
      { text: 'Présentation de l’application - fonctionnement complet', options: { breakLine: true } },
      { text: 'Suivi des membres · Tâches · Présence · Classement · Ressources', options: {} },
    ],
    { x: 0.9, y: 4.95, w: 9.5, h: 0.75, fontSize: 13, color: 'AEC6E4', lineSpacingMultiple: 1.35 }
  );

  s.addText('Septembre 2026', { x: 0.9, y: 6.45, w: 4, h: 0.35, fontSize: 12, bold: true, color: C.white });
  s.addNotes(
    "Bienvenue. Cette présentation fait le tour complet de l'application EMCY Dashboard : à quoi elle sert, comment chaque module fonctionne, et l'état d'avancement actuel. Toutes les captures d'écran proviennent de l'application réelle."
  );
});

/* ================= 2. SOMMAIRE ================= */
slide((s) => {
  s.background = { color: C.white };
  sectionLabel(s, 'Sommaire');
  s.addText('Ce que nous allons voir', { x: 0.55, y: 0.6, w: 9, h: 0.7, fontSize: 27, bold: true, color: C.ink });

  const items = [
    ['01', 'Vue d’ensemble & objectifs', 'Le problème, la solution, les acteurs'],
    ['02', 'Architecture & technologies', 'React, Express, stockage, sécurité'],
    ['03', 'Connexion & comptes', 'Accès sécurisé, rôles admin / membre'],
    ['04', 'Tableau de bord', 'Indicateurs temps réel de l’équipe'],
    ['05', 'Tâches & suivi de travail', 'Assignation, remises, validation'],
    ['06', 'Présence & calendrier', 'Pointage journalier, historique'],
    ['07', 'Membres, classement & profil', 'Gestion de l’équipe, gamification'],
    ['08', 'Ressources & avancement', 'Bibliothèque, échéancier, prochaines étapes'],
  ];

  items.forEach(([num, title, sub], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.6 + col * 6.25;
    const y = 1.75 + row * 1.28;
    s.addShape('roundRect', { x, y, w: 5.9, h: 1.08, rectRadius: 0.09, fill: { color: C.lightblue }, line: { color: C.line, width: 1 } });
    s.addText(num, { x: x + 0.22, y: y + 0.18, w: 0.85, h: 0.72, fontSize: 24, bold: true, color: C.blue, align: 'left' });
    s.addText(
      [
        { text: title, options: { fontSize: 14.5, bold: true, color: C.ink, breakLine: true } },
        { text: sub, options: { fontSize: 10.5, color: C.gray } },
      ],
      { x: x + 1.05, y: y + 0.14, w: 4.7, h: 0.85, valign: 'middle' }
    );
  });
  s.addNotes('Huit parties : le contexte, la technique, puis le parcours de chaque module avec ses captures, et enfin le planning.');
});

/* ================= 3. VUE D'ENSEMBLE ================= */
slide((s) => {
  s.background = { color: C.white };
  sectionLabel(s, 'Vue d’ensemble');
  s.addText('Une plateforme, deux objectifs', { x: 0.55, y: 0.6, w: 10, h: 0.7, fontSize: 27, bold: true, color: C.ink });

  // Two goal cards
  const cards = [
    {
      t: 'Piloter l’équipe',
      d: 'L’administration crée les comptes, assigne les tâches avec des échéances, suit l’assiduité jour par jour et mesure la performance de chaque membre - sans disperser l’information entre WhatsApp, Drive et documents.',
      icon: '◎',
    },
    {
      t: 'Organiser les membres',
      d: 'Chaque membre retrouve ses tâches, ses échéances, le calendrier de pointage, le classement et toutes les ressources officielles (logos, chartes, présentations) dans un espace unique et toujours à jour.',
      icon: '✦',
    },
  ];
  cards.forEach((c, i) => {
    const x = 0.6 + i * 6.25;
    s.addShape('roundRect', { x, y: 1.7, w: 5.9, h: 2.6, rectRadius: 0.1, fill: { color: C.lightblue }, line: { color: C.line, width: 1 } });
    s.addText(c.icon, { x: x + 0.3, y: 1.95, w: 0.6, h: 0.6, fontSize: 26, color: C.blue });
    s.addText(c.t, { x: x + 0.95, y: 1.98, w: 4.6, h: 0.5, fontSize: 17, bold: true, color: C.navy });
    s.addText(c.d, { x: x + 0.35, y: 2.6, w: 5.25, h: 1.55, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.2 });
  });

  s.addText('Les deux rôles', { x: 0.6, y: 4.65, w: 6, h: 0.4, fontSize: 15, bold: true, color: C.navy });
  const roles = [
    ['ADMINISTRATEUR', 'Crée les comptes · assigne et valide les tâches · pointe le suivi hebdomadaire · gère les ressources · consulte tous les indicateurs', C.navy],
    ['MEMBRE', 'Consulte ses tâches et échéances · remet son travail (lien ou fichier) · pointe sa présence · télécharge les ressources officielles', C.blue],
  ];
  roles.forEach(([t, d, color], i) => {
    const x = 0.6 + i * 6.25;
    s.addShape('roundRect', { x, y: 5.15, w: 5.9, h: 1.5, rectRadius: 0.1, fill: { color: C.white }, line: { color, width: 1.5 } });
    s.addText(t, { x: x + 0.3, y: 5.32, w: 5.2, h: 0.35, fontSize: 12.5, bold: true, color, charSpacing: 1.5 });
    s.addText(d, { x: x + 0.3, y: 5.68, w: 5.35, h: 0.85, fontSize: 10.5, color: C.gray, lineSpacingMultiple: 1.15 });
  });
  s.addNotes("L'application remplace la gestion dispersée par un espace unique. Les deux rôles structurent tout : l'admin pilote, le membre exécute et rend compte.");
});

/* ================= 4. ARCHITECTURE ================= */
slide((s) => {
  s.background = { color: C.white };
  sectionLabel(s, 'Technique');
  s.addText('Architecture de l’application', { x: 0.55, y: 0.6, w: 10, h: 0.7, fontSize: 27, bold: true, color: C.ink });

  // Pipeline: Client -> API -> Données
  const boxes = [
    ['CLIENT (React 19 + Vite)', 'Interface responsive · 9 écrans · graphiques Recharts · icônes Lucide', C.blue],
    ['API (Node.js + Express)', 'REST · JWT (7 jours) · rôles admin/membre · upload de fichiers (multer)', C.navy],
    ['DONNÉES (lowdb + disque/Blobs)', 'JSON versionné avec sauvegardes automatiques · fichiers dans /uploads · prêt pour Netlify Blobs en production', '37507A'],
  ];
  boxes.forEach(([t, d, color], i) => {
    const y = 1.85 + i * 1.62;
    s.addShape('roundRect', { x: 0.6, y, w: 6.6, h: 1.3, rectRadius: 0.1, fill: { color: C.white }, line: { color, width: 1.75 } });
    s.addText(t, { x: 0.95, y: y + 0.16, w: 5.9, h: 0.4, fontSize: 13.5, bold: true, color });
    s.addText(d, { x: 0.95, y: y + 0.56, w: 5.9, h: 0.62, fontSize: 10.5, color: C.gray, lineSpacingMultiple: 1.15 });
    if (i < 2) s.addText('▼', { x: 3.4, y: y + 1.3, w: 0.5, h: 0.3, fontSize: 13, color: C.blue, align: 'center' });
  });

  // Right column: security + qualite
  s.addText('Sécurité', { x: 7.8, y: 1.8, w: 5, h: 0.4, fontSize: 15, bold: true, color: C.navy });
  s.addText(
    [
      { text: 'Mots de passe hachés (bcrypt)', options: { bullet: { characterCode: '25AA', color: C.blue }, breakLine: true } },
      { text: 'Sessions JWT signées, expiration 7 jours', options: { bullet: { characterCode: '25AA', color: C.blue }, breakLine: true } },
      { text: 'Routes protégées par rôle (admin / membre)', options: { bullet: { characterCode: '25AA', color: C.blue }, breakLine: true } },
      { text: 'E-mails normalisés @emcy.ma à la création', options: { bullet: { characterCode: '25AA', color: C.blue } } },
    ],
    { x: 7.8, y: 2.2, w: 5.0, h: 1.7, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.3 }
  );

  s.addText('Qualité & fiabilité', { x: 7.8, y: 4.1, w: 5, h: 0.4, fontSize: 15, bold: true, color: C.navy });
  s.addText(
    [
      { text: 'Sauvegarde de la base avant chaque écriture (20 rotations)', options: { bullet: { characterCode: '25AA', color: C.blue }, breakLine: true } },
      { text: 'Limite de 25 Mo par fichier, types dangereux bloqués', options: { bullet: { characterCode: '25AA', color: C.blue }, breakLine: true } },
      { text: 'Déploiement Netlify (fonctions serverless + blobs)', options: { bullet: { characterCode: '25AA', color: C.blue }, breakLine: true } },
      { text: 'Interface responsive (mobile / tablette / desktop)', options: { bullet: { characterCode: '25AA', color: C.blue } } },
    ],
    { x: 7.8, y: 4.5, w: 5.0, h: 2.2, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.3 }
  );
  s.addNotes("Trois couches classiques : interface React, API Express sécurisée par JWT, et un stockage JSON avec sauvegardes automatiques avant chaque écriture. Le même code se déploie tel quel sur Netlify.");
});

/* ================= 5. CONNEXION ================= */
moduleSlide({
  kicker: 'Module 1 - Accès',
  title: 'Connexion sécurisée',
  lead: 'Chaque membre accède avec son adresse @emcy.ma officielle. La session reste valide 7 jours.',
  shot: SHOTS('00-login.png'),
  caption: 'Écran de connexion - identité EMCY',
  bullets: [
    'E-mail officiel @emcy.ma + mot de passe personnel',
    'Session sécurisée par jeton JWT (expiration automatique)',
    'Redirection intelligente : l’admin arrive sur le tableau de bord, le membre sur ses tâches',
    'Les comptes sont créés par l’administration uniquement',
    'Mot de passe oublié : réinitialisation par l’administrateur',
  ],
  note: "Point d'entrée unique. Le compte est créé par l'admin, l'e-mail est normalisé au format prenom.nom@emcy.ma.",
});

/* ================= 6. DASHBOARD ================= */
moduleSlide({
  kicker: 'Module 2 - Pilotage',
  title: 'Tableau de bord',
  lead: 'La vue d’ensemble temps réel : membres actifs, tâches, performance hebdomadaire et activité de l’équipe.',
  shot: SHOTS('01-dashboard.png'),
  caption: 'Tableau de bord administrateur - indicateurs et activité',
  bullets: [
    'Cartes d’indicateurs : membres, tâches créées, terminées, en attente',
    'Graphique « Team Performance Weekly » : taux d’accomplissement par semaine',
    'Répartition des membres par filière (projet)',
    'Fil d’activité : dernières actions de l’équipe (tâches, remises, publications)',
    'Accès rapide : « Assigner une tâche » en un clic',
  ],
  note: "Premier écran après connexion. Tous les chiffres sont calculés en direct depuis la base : tâches, présence hebdomadaire et journal d'activité.",
});

/* ================= 7. TACHES ================= */
moduleSlide({
  kicker: 'Module 3 - Organisation',
  title: 'Tâches & suivi de travail',
  lead: 'L’admin assigne, le membre exécute et remet son travail ; l’admin suit tout dans le traqueur.',
  shot: SHOTS('02-tracker.png'),
  caption: 'Traqueur des tâches (admin) - filtres et suivi des remises',
  bullets: [
    'Création de tâches : titre, description, pièce jointe, échéance, destinataire (un membre ou toute l’équipe)',
    'Badges d’échéance : à temps, urgent, en retard - calculés automatiquement',
    'Le membre remet son travail : note + lien (Drive, Canva…) ou fichier joint',
    'L’admin valide : la tâche passe « terminée » - il peut la rouvrir si besoin',
    'Filtres Tout / En attente / Terminé + statistiques de progression',
  ],
  note: "Le cœur du système. Cycle de vie complet : création -> échéance -> remise par le membre -> validation ou réouverture par l'admin.",
});

/* ================= 8. TACHE MEMBRE ================= */
moduleSlide({
  kicker: 'Module 3 - Espace membre',
  title: 'La vue du membre',
  lead: 'Chaque membre voit uniquement ses tâches, avec ses échéances et ses remises déjà envoyées.',
  shot: SHOTS('10-task-member.png'),
  caption: 'Espace tâches du membre - remise par lien ou fichier',
  bullets: [
    'Liste personnelle : tâches individuelles + annonces à toute l’équipe',
    'Compteurs : en attente / terminées, mis à jour en direct',
    'Remise en 2 clics : note explicative + lien du travail ou fichier téléversé',
    'Historique des travaux terminés avec date de soumission',
    'Aucune action possible sur les tâches des autres - isolation par rôle',
  ],
  note: "Le membre ne voit que ce qui le concerne. La remise accepte un lien (Drive, Canva, GitHub…) ou un fichier direct jusqu'à 10 Mo.",
});

/* ================= 9. CALENDRIER ================= */
moduleSlide({
  kicker: 'Module 4 - Présence',
  title: 'Calendrier & pointage',
  lead: 'Chaque journée de travail est tracée : fait / non fait, avec note et pièce jointe si besoin.',
  shot: SHOTS('05-calendar.png'),
  caption: 'Calendrier de présence - vue mensuelle avec indicateurs',
  bullets: [
    'Vue calendrier du mois : indicateur vert / rouge sur chaque jour pointé',
    'Le membre pointe lui-même sa journée (ou l’admin le fait pour lui)',
    'Statistiques du mois : jours faits, non faits, taux de présence',
    'L’admin peut consulter le calendrier de n’importe quel membre',
    'Note + lien de travail attachés à chaque pointage',
  ],
  note: "Le pointage journalier complète le suivi hebdomadaire : il alimente les statistiques de présence et l'historique consultable par l'admin.",
});

/* ================= 10. MEMBRES ================= */
moduleSlide({
  kicker: 'Module 5 - Équipe',
  title: 'Gestion des membres',
  lead: 'L’admin crée, modifie et suit chaque membre : filière, compétences, date d’entrée et assiduité.',
  shot: SHOTS('03-members.png'),
  caption: 'Annuaire des membres - recherche et fiches détaillées',
  bullets: [
    'Fiches membres : avatar, e-mail, filière, compétences, date d’entrée',
    'Création de compte en un formulaire (rôle membre ou administrateur)',
    'Modification et désactivation directement depuis la fiche',
    'Suivi individuel : semaines validées, tâches, calendrier de présence',
    'Recherche instantanée par nom, e-mail ou filière',
  ],
  note: "L'annuaire centralise la vie du compte : de la création (l'e-mail @emcy.ma est généré au bon format) jusqu'au suivi individuel.",
});

/* ================= 11. CLASSEMENT ================= */
moduleSlide({
  kicker: 'Module 6 - Motivation',
  title: 'Classement & profil',
  lead: 'La gamification en interne : un podium et un classement basés sur les tâches réellement terminées.',
  shot: SHOTS('04-ranking.png'),
  caption: 'Classement de l’équipe - podium du top 3',
  bullets: [
    'Podium visuel du top 3 (or / argent / bronze)',
    'Classement complet : tâches terminées par membre',
    'Badges de rang pour les trois premiers',
    'Profil personnel : informations, filière et courbe de progression hebdomadaire',
    'Source unique de vérité : seules les tâches validées comptent',
  ],
  note: "Le classement compte uniquement les tâches terminées et validées - pas de triche possible. Le profil affiche la courbe personnelle de progression.",
});

/* ================= 12. RESSOURCES ================= */
moduleSlide({
  kicker: 'Module 7 - Bibliothèque',
  title: 'Espace ressources',
  lead: 'Tous les documents officiels de l’organisation, centralisés et accessibles à toute l’équipe.',
  shot: SHOTS('06-resources.png'),
  caption: 'Espace ressources - 19 documents importés, filtres par catégorie',
  bullets: [
    'Logos officiels (EMC, EMC Youth, CMRPI) avec aperçus visuels',
    'Charte et règlement 2026, présentations FR/AR (général et -12 ans)',
    'Fiches de préparation des épisodes (invités, talking points)',
    'Filtres par catégorie avec compteurs + recherche instantanée',
    'L’admin ajoute ou supprime ; les membres téléchargent',
  ],
  note: "La bibliothèque est déjà alimentée avec les 19 fichiers officiels : logos, charte, règlement, 6 présentations, 7 fiches épisodes et l'archive photo.",
});

/* ================= 13. MOBILE ================= */
slide((s) => {
  s.background = { color: C.white };
  sectionLabel(s, 'Sur tous les écrans');
  s.addText('Pensé pour le mobile', { x: 0.55, y: 0.6, w: 8.5, h: 0.7, fontSize: 27, bold: true, color: C.ink });
  s.addText(
    [
      { text: 'Toute l’application s’adapte aux petits écrans : menu coulissant, cartes empilées, formulaires simplifiés.', options: { breakLine: true } },
      { text: '', options: { breakLine: true } },
      { text: 'Le membre peut consulter ses tâches et pointer sa présence depuis son téléphone, en réunion comme sur le terrain.', options: {} },
    ],
    { x: 0.6, y: 1.6, w: 7.6, h: 2.6, fontSize: 14, color: C.ink, lineSpacingMultiple: 1.3 }
  );

  const feats = [
    ['Responsive', 'Grille fluide, de 360 px au grand écran'],
    ['Léger', 'Interface rapide, même en connexion faible'],
    ['Uniforme', 'Même compte, mêmes données, tout appareil'],
  ];
  feats.forEach(([t, d], i) => {
    const y = 4.35 + i * 0.95;
    s.addShape('roundRect', { x: 0.6, y, w: 7.4, h: 0.78, rectRadius: 0.09, fill: { color: C.lightblue }, line: { color: C.line, width: 1 } });
    s.addText(t, { x: 0.9, y: y + 0.1, w: 1.8, h: 0.55, fontSize: 13, bold: true, color: C.blue, valign: 'middle' });
    s.addText(d, { x: 2.7, y: y + 0.1, w: 5.1, h: 0.55, fontSize: 11.5, color: C.ink, valign: 'middle' });
  });

  // Phone frame
  const pw = 3.1;
  const ph = pw * (844 / 390);
  const px = W - pw - 1.15;
  const py = (H - ph) / 2 - 0.25;
  s.addShape('roundRect', { x: px - 0.14, y: py - 0.14, w: pw + 0.28, h: ph + 0.28, rectRadius: 0.28, fill: { color: '16263D' }, line: { type: 'none' }, shadow: { type: 'outer', blur: 16, offset: 4, angle: 90, color: '8A9BB0', opacity: 0.4 } });
  s.addImage({ data: SHOTS('09-mobile-dashboard.png'), x: px, y: py, w: pw, h: ph, rounding: false });
  s.addNotes("Preuve concrète : capture réelle du tableau de bord sur un écran de téléphone (390 px de large).");
});

/* ================= 14. ETAT D'AVANCEMENT ================= */
slide((s) => {
  s.background = { color: C.white };
  sectionLabel(s, 'Bilan');
  s.addText('État d’avancement par module', { x: 0.55, y: 0.6, w: 10, h: 0.7, fontSize: 27, bold: true, color: C.ink });

  const rows = [
    ['Authentification & comptes', 'Connexion JWT, rôles, e-mails @emcy.ma', '100 %', C.green],
    ['Tableau de bord & statistiques', 'Indicateurs, graphiques, activité', '100 %', C.green],
    ['Tâches & remises de travail', 'Création, échéances, remises, validation', '100 %', C.green],
    ['Calendrier & présence', 'Pointage journalier, stats mensuelles', '100 %', C.green],
    ['Membres & classement', 'Fiches, filières, podium, rangs', '100 %', C.green],
    ['Espace ressources', 'Upload/téléchargement, catégories, 19 fichiers', '100 %', C.green],
    ['Notifications automatiques', 'Rappels d’échéance par e-mail', 'Planifié', C.blue],
    ['Application mobile native', 'PWA hors-ligne', 'Vision', C.gray],
  ];

  const tx = 0.6, tw = W - 1.2;
  const colW = [4.35, 4.6, 2.16];
  const rowH = 0.52;

  // Header
  s.addShape('rect', { x: tx, y: 1.7, w: tw, h: rowH, fill: { color: C.navy }, line: { type: 'none' } });
  ['MODULE', 'CONTENU', 'ÉTAT'].forEach((h, i) => {
    const x = tx + colW.slice(0, i).reduce((a, b) => a + b, 0);
    s.addText(h, { x: x + 0.18, y: 1.7, w: colW[i] - 0.3, h: rowH, fontSize: 11, bold: true, color: C.white, valign: 'middle', charSpacing: 1.5 });
  });

  rows.forEach(([mod, desc, etat, color], i) => {
    const y = 1.7 + rowH * (i + 1);
    if (i % 2 === 0) s.addShape('rect', { x: tx, y, w: tw, h: rowH, fill: { color: 'F4F8FC' }, line: { type: 'none' } });
    s.addShape('line', { x: tx, y: y + rowH, w: tw, h: 0, line: { color: C.line, width: 0.75 } });
    const cx = (j) => tx + colW.slice(0, j).reduce((a, b) => a + b, 0);
    s.addText(mod, { x: cx(0) + 0.18, y, w: colW[0] - 0.3, h: rowH, fontSize: 11.5, bold: true, color: C.ink, valign: 'middle' });
    s.addText(desc, { x: cx(1) + 0.18, y, w: colW[1] - 0.3, h: rowH, fontSize: 10.5, color: C.gray, valign: 'middle' });
    s.addShape('roundRect', { x: cx(2) + 0.12, y: y + 0.1, w: 1.5, h: 0.32, rectRadius: 0.16, fill: { color }, line: { type: 'none' } });
    s.addText(etat, { x: cx(2) + 0.12, y: y + 0.1, w: 1.5, h: 0.32, fontSize: 9.5, bold: true, color: C.white, align: 'center', valign: 'middle' });
  });

  s.addText(
    [
      { text: '6 modules sur 6 livrés', options: { bold: true, color: C.green } },
      { text: ' - l’application est utilisable quotidiennement par toute l’équipe.', options: { color: C.gray } },
    ],
    { x: 0.6, y: 6.45, w: 12, h: 0.4, fontSize: 13 }
  );
  s.addNotes("Tout le périmètre initial est livré et fonctionnel. Les deux lignes du bas sont les suites envisagées, pas des manques.");
});

/* ================= 15. PROCHAINES ETAPES ================= */
slide((s) => {
  s.background = { color: C.white };
  sectionLabel(s, 'Suite');
  s.addText('Prochaines étapes', { x: 0.55, y: 0.6, w: 10, h: 0.7, fontSize: 27, bold: true, color: C.ink });

  const steps = [
    ['Court terme', ['Notifications par e-mail à l’assignation d’une tâche', 'Export mensuel des présences en PDF/Excel', 'Édition des ressources déjà publiées'], C.blue],
    ['Moyen terme', ['Statistiques avancées par filière', 'Messagerie interne par tâche (commentaires)', 'Mode hors-ligne (PWA installable)'], C.navy],
    ['Adoption', ['Formation de l’équipe (30 min)', 'Migration des historiques restants', 'Retours utilisateurs -> itérations'], '37507A'],
  ];
  steps.forEach(([t, items, color], i) => {
    const x = 0.6 + i * 4.18;
    s.addShape('roundRect', { x, y: 1.8, w: 3.9, h: 4.5, rectRadius: 0.12, fill: { color: C.white }, line: { color, width: 1.5 } });
    s.addShape('roundRect', { x: x + 0.3, y: 2.1, w: 1.9, h: 0.4, rectRadius: 0.2, fill: { color }, line: { type: 'none' } });
    s.addText(t, { x: x + 0.3, y: 2.1, w: 1.9, h: 0.4, fontSize: 10.5, bold: true, color: C.white, align: 'center', valign: 'middle', charSpacing: 1 });
    const list = items.map((it, j) => ({
      text: it,
      options: { bullet: { characterCode: '25AA', color }, breakLine: j < items.length - 1 },
    }));
    s.addText(list, { x: x + 0.35, y: 2.75, w: 3.3, h: 3.3, fontSize: 12, color: C.ink, lineSpacingMultiple: 1.35, valign: 'top' });
  });

  s.addText(
    [
      { text: 'Objectif : ', options: { bold: true, color: C.navy } },
      { text: 'faire de EMCY Dashboard l’outil quotidien unique de l’équipe - pilotage, exécution et ressources.', options: { color: C.gray } },
    ],
    { x: 0.6, y: 6.55, w: 12, h: 0.4, fontSize: 13 }
  );
  s.addNotes('Trois horizons : consolider (notifications, exports), enrichir (stats, messagerie, PWA), et accompagner l’adoption par l’équipe.');
});

/* ================= 16. MERCI ================= */
slide((s) => {
  s.background = { color: C.navy };
  s.addShape('rect', { x: 0, y: 0, w: W, h: 0.18, fill: { color: C.blue } });
  s.addShape('ellipse', { x: -2.2, y: -2.6, w: 6.5, h: 6.5, fill: { color: '26496F' }, line: { type: 'none' } });
  s.addShape('ellipse', { x: W - 4.2, y: H - 3.2, w: 6.5, h: 6.5, fill: { color: '26496F' }, line: { type: 'none' } });

  s.addText('Merci', { x: 0.9, y: 2.5, w: 11.5, h: 1.1, fontSize: 60, bold: true, color: C.white });
  s.addText('Des questions ?', { x: 0.92, y: 3.7, w: 8, h: 0.55, fontSize: 22, color: 'C9D9EE' });

  s.addText(
    [
      { text: 'EMCY Dashboard - État d’avancement', options: { bold: true, color: C.white, breakLine: true } },
      { text: 'Morocco CyberScripts Space - Youth · Septembre 2026', options: { color: 'AEC6E4' } },
    ],
    { x: 0.9, y: 5.9, w: 10, h: 0.7, fontSize: 13, lineSpacingMultiple: 1.3 }
  );
  s.addNotes('Merci de votre attention - place à la démonstration en direct si besoin.');
});

// Footers on all except first and last
slideRefs.forEach((s, i) => {
  if (i !== 0 && i !== slideRefs.length - 1) footer(s, i + 1, slideRefs.length);
});

const OUT = path.join(__dirname, 'EMCY-Dashboard_Etat-davancement_FR.pptx');
pptx.writeFile({ fileName: OUT }).then(() => {
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log('Deck written: ' + OUT + ' (' + kb + ' KB, ' + slideRefs.length + ' slides)');
});
