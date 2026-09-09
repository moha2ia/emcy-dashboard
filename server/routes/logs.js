const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { dbReady } = require('../config/db');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const store = require('../config/store');

// Files are held in memory only, then persisted through the storage driver
// (filesystem locally, Netlify Blobs in production).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * GET /api/logs
 * Get work logs for a specific month or user
 */
router.get('/', auth, async (req, res) => {
  try {
    const db = await dbReady;
    const { userId, month, year } = req.query;
    // Members may only ever read their own logs
    const targetUserId = req.user.role === 'admin' ? (userId || req.user.id) : req.user.id;
    let query = db.get('workLogs');
    if (targetUserId) query = query.filter({ userId: targetUserId });
    let logs = query.value();
    if (month && year) {
      const monthPrefix = `${year}-${month.toString().padStart(2, '0')}`;
      logs = logs.filter(log => log.date.startsWith(monthPrefix));
    }
    res.json({ logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * GET /api/logs/recent
 * Get latest logs from all users (Admin only)
 */
router.get('/recent', auth, async (req, res) => {
  try {
    const db = await dbReady;
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden.' });
    
    const logs = db.get('workLogs')
      .orderBy(['createdAt', 'date'], ['desc', 'desc'])
      .take(15)
      .value();
    
    const users = db.get('users').value();
    
    const activity = logs.map(log => {
      const user = users.find(u => u.id === log.userId);
      return {
        ...log,
        userName: user ? user.name : 'Unknown User',
        userAvatar: user ? user.avatar : null,
        userProject: user ? user.project : ''
      };
    });

    
    res.json({ activity });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * POST /api/logs/upload
 * Upload a work file
 */
router.post('/upload', auth, upload.single('workFile'), async (req, res) => {
  try {
    const db = await dbReady;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const filename = 'work-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(req.file.originalname);
    await store.saveUpload('work', filename, req.file.buffer);
    const filePath = `/uploads/work/${filename}`;
    res.json({ message: 'File uploaded successfully.', path: filePath, originalName: req.file.originalname });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed.' });
  }
});

/**
 * POST /api/logs
 * Create or update a work log for a specific date
 */
router.post('/', auth, async (req, res) => {
  try {
    const db = await dbReady;
    const { date, status, note, userId, workLink } = req.body;
    if (!date || !status) return res.status(400).json({ message: 'Date and status are required.' });
    
    const targetUserId = (req.user.role === 'admin' && userId) ? userId : req.user.id;
    const existingLog = db.get('workLogs').find({ userId: targetUserId, date }).value();
    
    const logData = {
      status,
      note: note || '',
      workLink: workLink || '',
      updatedAt: new Date().toISOString()
    };

    if (existingLog) {
      await db.get('workLogs').find({ id: existingLog.id }).assign(logData).write();
      return res.json({ message: 'Log updated.', log: db.get('workLogs').find({ id: existingLog.id }).value() });
    } else {
      const newLog = {
        id: uuidv4(),
        userId: targetUserId,
        date,
        ...logData,
        createdAt: new Date().toISOString(),
      };
      await db.get('workLogs').push(newLog).write();
      return res.json({ message: 'Log created.', log: newLog });
    }
  } catch (error) {
    console.error('Create log error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
