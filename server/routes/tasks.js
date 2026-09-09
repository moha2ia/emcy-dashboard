const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { UPLOADS_DIR } = require('../config/paths');

// Configure multer for work file uploads (relative to the server directory, not CWD)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(UPLOADS_DIR, 'work'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'task-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

/**
 * GET /api/tasks
 * - Admin: returns all tasks with user details
 * - Member: returns only tasks assigned to them (or 'all')
 */
router.get('/', auth, (req, res) => {
  try {
    const allTasks = db.get('tasks').value();
    const users = db.get('users').value();

    let tasks;
    if (req.user.role === 'admin') {
      tasks = allTasks;
    } else {
      tasks = allTasks.filter(
        (t) => t.assignedTo === req.user.id || t.assignedTo === 'all'
      );
    }

    // Enrich with user info
    const enriched = tasks.map((t) => {
      const assignedUser =
        t.assignedTo === 'all'
          ? null
          : users.find((u) => u.id === t.assignedTo);
      return {
        ...t,
        assignedToName: t.assignedTo === 'all' ? 'All Members' : (assignedUser ? assignedUser.name : 'Unknown'),
        assignedToProject: assignedUser ? assignedUser.project : '',
        assignedToAvatar: assignedUser ? assignedUser.avatar : null,
      };
    });

    // Sort: pending first, then by deadline (soonest first), then creation desc
    enriched.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      const aDl = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bDl = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (aDl !== bDl) return aDl - bDl;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({ tasks: enriched });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * POST /api/tasks
 * Admin creates a task assigned to a specific user or 'all'
 */
router.post('/', auth, adminOnly, (req, res) => {
  try {
    const { title, description, assignedTo, attachment, deadline } = req.body;
    if (!title || !assignedTo) {
      return res.status(400).json({ message: 'Title and assignedTo are required.' });
    }

    // Validate assignedTo
    if (assignedTo !== 'all') {
      const user = db.get('users').find({ id: assignedTo }).value();
      if (!user) return res.status(404).json({ message: 'Assigned user not found.' });
    }

    // Validate deadline: optional, ISO, and must be in the future (5 min tolerance)
    let deadlineIso = null;
    if (deadline) {
      const d = new Date(deadline);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Deadline must be a valid date.' });
      }
      if (d.getTime() < Date.now() - 5 * 60 * 1000) {
        return res.status(400).json({ message: 'Deadline must be in the future.' });
      }
      deadlineIso = d.toISOString();
    }

    const newTask = {
      id: uuidv4(),
      title: title.trim(),
      description: description ? description.trim() : '',
      assignedTo,
      status: 'pending',
      note: '',
      workLink: '',
      attachment: attachment || '',
      deadline: deadlineIso,
      createdAt: new Date().toISOString(),
      doneAt: null,
    };

    db.get('tasks').push(newTask).write();
    res.status(201).json({ message: 'Task created.', task: newTask });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * PUT /api/tasks/:id/complete
 * Member marks their task as done (with optional note + workLink)
 */
router.put('/:id/complete', auth, (req, res) => {
  try {
    const { id } = req.params;
    const { note, workLink } = req.body;
    const task = db.get('tasks').find({ id }).value();

    if (!task) return res.status(404).json({ message: 'Task not found.' });

    // Members can only complete tasks assigned to them or 'all'
    if (req.user.role !== 'admin') {
      if (task.assignedTo !== req.user.id && task.assignedTo !== 'all') {
        return res.status(403).json({ message: 'Forbidden.' });
      }
    }

    if (task.status === 'done') {
      return res.status(400).json({ message: 'Task already completed.' });
    }

    db.get('tasks').find({ id }).assign({
      status: 'done',
      note: note || '',
      workLink: workLink || '',
      doneAt: new Date().toISOString(),
      doneBy: req.user.id,
    }).write();

    const updated = db.get('tasks').find({ id }).value();
    res.json({ message: 'Task marked as done.', task: updated });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * PUT /api/tasks/:id/reopen
 * Admin can reopen a completed task
 */
router.put('/:id/reopen', auth, adminOnly, (req, res) => {
  try {
    const { id } = req.params;
    const task = db.get('tasks').find({ id }).value();
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    db.get('tasks').find({ id }).assign({
      status: 'pending',
      note: '',
      workLink: '',
      doneAt: null,
      doneBy: null,
    }).write();

    res.json({ message: 'Task reopened.', task: db.get('tasks').find({ id }).value() });
  } catch (error) {
    console.error('Reopen task error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * POST /api/tasks/upload
 * Upload a work file for task submission
 */
router.post('/upload', auth, upload.single('workFile'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const filePath = `/uploads/work/${req.file.filename}`;
    res.json({ message: 'File uploaded successfully.', path: filePath, originalName: req.file.originalname });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed.' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Admin deletes a task
 */
router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    const { id } = req.params;
    const task = db.get('tasks').find({ id }).value();
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    db.get('tasks').remove({ id }).write();
    res.json({ message: 'Task deleted.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
