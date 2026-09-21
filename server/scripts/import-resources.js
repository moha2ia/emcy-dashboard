/**
 * Bulk-import every file from resourses/platform into the Resources area.
 *
 * - Copies each file into the uploads store (resources/ folder) via the
 *   storage driver, then records it in db.json exactly like an admin upload.
 * - Polished titles/categories/descriptions come from the CATALOG below;
 *   unknown files fall back to a cleaned-up filename title.
 * - Idempotent: a file whose original name is already in the db is skipped,
 *   so the script can be re-run safely (e.g. after dropping new files in).
 * - Attributes imports to the seeded system admin.
 *
 * NOTE: run while the API server is STOPPED - the running server keeps
 * db.json in memory and would overwrite the import on its next write.
 *
 * Usage: node scripts/import-resources.js [--source "path/to/folder"]
 */
const fs = require('fs');
const path = require('path');
const low = require('lowdb');
const { v4: uuidv4 } = require('uuid');
const store = require('../config/store');

const DEFAULTS = { users: [], weeklyProgress: [], workLogs: [], tasks: [], resources: [] };

const sourceIdx = process.argv.indexOf('--source');
let SOURCE_DIR;
if (sourceIdx !== -1 && process.argv[sourceIdx + 1]) {
  SOURCE_DIR = path.resolve(process.argv[sourceIdx + 1]);
} else {
  // Default: look for the EMCY-docs folder next to the repo (member data is
  // kept out of the repository on purpose). Override with --source.
  const candidate = path.join(store.SERVER_ROOT, '..', '..', 'EMCY-docs', 'resourses', 'platform');
  if (fs.existsSync(candidate)) {
    SOURCE_DIR = candidate;
  } else {
    console.error('No source folder found. Pass one with:  node scripts/import-resources.js --source "path/to/folder"');
    process.exit(1);
  }
}

// ASCII-safe stored filename from any original name (accents, parens, spaces)
function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
}

// Curated metadata per source file, keyed by slugified filename
const CATALOG = {
  'charte_emc_youth_2026.pdf': {
    title: 'EMC Youth Charter 2026',
    category: 'docs',
    description: 'Official EMC Youth charter: values, governance and member commitments for the 2026 season.',
  },
  'reglement_emc_youth_2026.pdf': {
    title: 'EMC Youth Rules & Regulations 2026',
    category: 'docs',
    description: 'Official internal rules (règlement intérieur): expectations, conduct and discipline for all members.',
  },
  'cmrpi-logo-transparent.png': {
    title: 'CMRPI Logo - Transparent',
    category: 'brand',
    description: 'Official CMRPI partner logo on a transparent background, for co-branded materials.',
  },
  'emc-logo.png': {
    title: 'EMC Official Logo',
    category: 'brand',
    description: 'Main EMC logo in full quality - use for posters, banners and official documents.',
  },
  'emc-youth-logo.png': {
    title: 'EMC Youth Logo',
    category: 'brand',
    description: 'EMC Youth program logo - for youth-branded content and social media.',
  },
  'presentation-arabe.pdf': {
    title: 'Presentation Deck - Arabic (General)',
    category: 'presentations',
    description: 'Full Arabic EMC Youth presentation deck for general audiences.',
  },
  'presentation-arabe-12ans.pdf': {
    title: 'Presentation Deck - Arabic (Under 12)',
    category: 'presentations',
    description: 'Simplified Arabic presentation tailored to participants under 12 years old.',
  },
  'presentation-francais.pdf': {
    title: 'Presentation Deck - French (General)',
    category: 'presentations',
    description: 'Full French EMC Youth presentation deck for general audiences.',
  },
  'presentation-francais-12ans.pdf': {
    title: 'Presentation Deck - French (Under 12)',
    category: 'presentations',
    description: 'Simplified French presentation tailored to participants under 12 years old.',
  },
  'presentation-emc-youth-sensibilisation-ar-2025-final.pdf': {
    title: 'Awareness Deck - Arabic 2025 (Final)',
    category: 'presentations',
    description: 'Finalized 2025 Arabic awareness (sensibilisation) deck used during school visits.',
  },
  'presentation-emc-youth-sensibilisation-ar-2024-2025.pdf-1.pdf': {
    title: 'Awareness Deck - Arabic 2024-2025',
    category: 'presentations',
    description: 'Archived 2024-2025 Arabic awareness (sensibilisation) deck.',
  },
  'episode-houda-adli.docx': {
    title: 'Episode Prep - Houda Adli',
    category: 'episodes',
    description: 'Guest profile and talking points for the Houda Adli episode.',
  },
  'episode-janice-richardson.docx': {
    title: 'Episode Prep - Janice Richardson',
    category: 'episodes',
    description: 'Guest profile and talking points for the Janice Richardson episode.',
  },
  'episode-professeur.docx': {
    title: 'Episode Prep - Guest Professor',
    category: 'episodes',
    description: 'Guest profile and talking points for the professor episode.',
  },
  'episode-rachida-margane.docx': {
    title: 'Episode Prep - Rachida Margane',
    category: 'episodes',
    description: 'Guest profile and talking points for the Rachida Margane episode.',
  },
  'episode-raouia.docx': {
    title: 'Episode Prep - Raouia',
    category: 'episodes',
    description: 'Guest profile and talking points for the Raouia episode.',
  },
  'episode-youssef-bentaleb.docx': {
    title: 'Episode Prep - Youssef Bentaleb',
    category: 'episodes',
    description: 'Guest profile and talking points for the Youssef Bentaleb episode.',
  },
  'episode-influ-ilyass-tass.docx': {
    title: 'Episode Prep - Ilyass Tass (Influencer)',
    category: 'episodes',
    description: 'Guest profile and talking points for the Ilyass Tass influencer episode.',
  },
  'members-pictures.zip': {
    title: 'Members Photo Archive',
    category: 'media',
    description: 'Photo archive of EMCY members (ZIP) - for internal use, events and reports.',
  },
};

function fallbackMeta(file) {
  const base = file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return {
    title: base.replace(/\b\w/g, (c) => c.toUpperCase()),
    category: '',
    description: '',
  };
}

(async () => {
  if (!fs.existsSync(SOURCE_DIR) || !fs.statSync(SOURCE_DIR).isDirectory()) {
    console.error('Source folder not found: ' + SOURCE_DIR);
    process.exit(1);
  }

  const db = await Promise.resolve(low(store.makeDbAdapter(DEFAULTS)));
  if (!Array.isArray(db.get('resources').value())) {
    await db.set('resources', []).write();
  }

  const admin = db.get('users').find({ role: 'admin' }).value();
  if (!admin) {
    console.error('No admin user found in the database - start the server once first so it seeds one.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => fs.statSync(path.join(SOURCE_DIR, f)).isFile() && !f.startsWith('.'))
    .sort();

  const existingNames = new Set(db.get('resources').value().map((r) => r.fileName));
  const takenStored = new Set(db.get('resources').value().map((r) => r.filePath));

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    if (existingNames.has(file)) {
      console.log('skip (already imported): ' + file);
      skipped += 1;
      continue;
    }

    const meta = CATALOG[slugify(file)] || fallbackMeta(file);
    if (!CATALOG[slugify(file)]) {
      console.log('note: no catalog entry for "' + file + '" - using filename as title');
    }

    const ext = path.extname(file);
    let stored = 'imported-' + slugify(path.basename(file, ext)) + ext.toLowerCase();
    while (takenStored.has('/uploads/resources/' + stored)) {
      stored = stored.replace(/(\.[^.]+)$/, '-x$1');
    }
    takenStored.add('/uploads/resources/' + stored);

    const buffer = fs.readFileSync(path.join(SOURCE_DIR, file));
    await store.saveUpload('resources', stored, buffer);

    const resource = {
      id: uuidv4(),
      type: 'file',
      title: meta.title,
      description: meta.description,
      category: meta.category,
      filePath: '/uploads/resources/' + stored,
      fileName: file,
      fileSize: buffer.length,
      uploadedBy: admin.id,
      uploadedByName: admin.name,
      createdAt: new Date().toISOString(),
    };

    await db.get('resources').push(resource).write();
    console.log('imported: ' + file + '  ->  ' + meta.title + ' [' + (meta.category || 'general') + ']');
    imported += 1;
  }

  console.log('\nDone: ' + imported + ' imported, ' + skipped + ' skipped.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
