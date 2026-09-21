const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const { dbReady } = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const store = require('../config/store');

// Files are held in memory only, then persisted through the storage driver
// (filesystem locally, Netlify Blobs in production). Resources can be heavier
// than task attachments (logo packs, PDFs), so the cap is a bit higher.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    // Block executable/script payloads; documents, images, archives allowed
    const blocked = /\.(exe|bat|cmd|sh|msi|com|scr|ps1)$/i;
    if (blocked.test(path.extname(file.originalname))) {
      cb(new Error('This file type is not allowed.'));
      return;
    }
    cb(null, true);
  },
});

// Older databases predate the resources collection - create it on demand so
// pushes never hit an undefined key.
async function ensureResourcesCollection(db) {
  if (!Array.isArray(db.get('resources').value())) {
    await db.set('resources', []).write();
  }
}

/**
 * GET /api/resources
 * Every signed-in member can browse the resource area. Newest first.
 */
router.get('/', auth, async (req, res) => {
  try {
    const db = await dbReady;
    await ensureResourcesCollection(db);
    const resources = (db.get('resources').value() || []).slice();
    resources.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ resources });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * POST /api/resources
 * Admin adds a link resource (Canvas, Google Drive, Figma, brand portal...).
 */
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const db = await dbReady;
    await ensureResourcesCollection(db);

    const { title, description, url, category } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required.' });
    }
    if (!url || !url.trim()) {
      return res.status(400).json({ message: 'URL is required.' });
    }
    if (!/^https?:\/\/\S+/i.test(url.trim())) {
      return res.status(400).json({ message: 'URL must start with http:// or https://.' });
    }

    const resource = {
      id: uuidv4(),
      type: 'link',
      title: title.trim(),
      description: (description || '').trim(),
      url: url.trim(),
      category: (category || '').trim(),
      uploadedBy: req.user.id,
      uploadedByName: req.user.name,
      createdAt: new Date().toISOString(),
    };

    await db.get('resources').push(resource).write();
    res.status(201).json({ message: 'Resource added.', resource });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * POST /api/resources/upload
 * Admin uploads a file resource (logo pack, PDF...) as multipart/form-data:
 *   file, title, description?, category?
 * The upload and the resource record are created in one step, so there is
 * never an orphaned file in the store.
 */
router.post('/upload', auth, adminOnly, upload.single('file'), async (req, res) => {
  try {
    const db = await dbReady;
    await ensureResourcesCollection(db);

    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ message: 'Title is required.' });
    }

    const filename =
      'resource-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(req.file.originalname);
    await store.saveUpload('resources', filename, req.file.buffer);
    const filePath = `/uploads/resources/${filename}`;

    const resource = {
      id: uuidv4(),
      type: 'file',
      title: req.body.title.trim(),
      description: (req.body.description || '').trim(),
      category: (req.body.category || '').trim(),
      filePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploadedBy: req.user.id,
      uploadedByName: req.user.name,
      createdAt: new Date().toISOString(),
    };

    await db.get('resources').push(resource).write();
    res.status(201).json({ message: 'Resource uploaded.', resource });
  } catch (error) {
    console.error('Upload resource error:', error);
    res.status(500).json({ message: 'Upload failed.' });
  }
});

/**
 * DELETE /api/resources/:id
 * Admin removes a resource; file resources are deleted from the store too.
 */
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const db = await dbReady;
    await ensureResourcesCollection(db);
    const { id } = req.params;
    const resource = db.get('resources').find({ id }).value();
    if (!resource) return res.status(404).json({ message: 'Resource not found.' });

    if (resource.type === 'file' && resource.filePath) {
      // "/uploads/resources/<name>" → store key "resources/<name>"
      await store.deleteUpload(resource.filePath.replace('/uploads/', ''));
    }

    await db.get('resources').remove({ id }).write();
    res.json({ message: 'Resource deleted.' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
