const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const store = require('../config/store');
const { dbReady } = require('../config/db');
const { auth, adminOnly, isOwner } = require('../middleware/auth');
const { validateEmcyEmail } = require('../utils/emcyEmail');

// Files are held in memory only, then persisted through the storage driver
// (filesystem locally, Netlify Blobs in production).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, png, webp) are allowed.'));
  },
});

/**
 * POST /api/users/upload
 * Upload a profile image and return the path
 */
router.post('/upload', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  const filename = 'avatar-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(req.file.originalname);
  await store.saveUpload('avatars', filename, req.file.buffer);
  const filePath = `/uploads/avatars/${filename}`;
  res.json({ message: 'File uploaded successfully.', path: filePath });
});

/**
 * GET /api/users
 * List all users (admin sees all, members see limited info)
 */
router.get('/', auth, async (req, res) => {
  try {
    const db = await dbReady;
    let users = db.get('users').value();

    // Strip passwords
    users = users.map(({ password, ...user }) => user);

    // Get progress data for score calculation
    const allProgress = db.get('weeklyProgress').value();
    const totalWeeks = Math.max(
      ...allProgress.map((p) => p.weekNumber),
      1
    );

    // Calculate scores for each user
    users = users.map((user) => {
      const userProgress = allProgress.filter((p) => p.userId === user.id);
      const weeksDone = userProgress.filter((p) => p.status === 'done').length;
      const totalUserWeeks = userProgress.length || 1;
      const score = Math.round((weeksDone / totalUserWeeks) * 100);

      return {
        ...user,
        score,
        weeksDone,
        totalWeeks: totalUserWeeks,
      };
    });

    res.json({ users, totalWeeks });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * GET /api/users/ranking
 * Get members ranked by number of tasks completed (descending)
 */
router.get('/ranking', auth, async (req, res) => {
  try {
    const db = await dbReady;
    const members = db.get('users').filter({ role: 'member' }).value();
    const tasks = db.get('tasks').value();

    const ranking = members
      .map(({ password, ...member }) => {
        // Count tasks this member actually completed (doneBy is set on completion,
        // whether the task was assigned to them individually or to 'all')
        const tasksDone = tasks.filter(
          (t) => t.status === 'done' && t.doneBy === member.id
        ).length;
        return { ...member, tasksDone };
      })
      .sort((a, b) => b.tasksDone - a.tasksDone || a.name.localeCompare(b.name))
      .map((member, index) => ({ ...member, rank: index + 1 }));

    res.json({ ranking });
  } catch (error) {
    console.error('Get ranking error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * GET /api/users/:id
 * Get a single user by ID
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const db = await dbReady;
    const user = db.get('users').find({ id: req.params.id }).value();

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const { password, ...userResponse } = user;

    // Get user's progress
    const progress = db.get('weeklyProgress')
      .filter({ userId: user.id })
      .sortBy('weekNumber')
      .value();

    const weeksDone = progress.filter((p) => p.status === 'done').length;
    const totalWeeks = progress.length || 1;
    const score = Math.round((weeksDone / totalWeeks) * 100);

    res.json({
      user: {
        ...userResponse,
        score,
        weeksDone,
        totalWeeks,
        progress,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * PUT /api/users/:id
 * Update a user (admin or self)
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const db = await dbReady;
    const { id } = req.params;

    // Only admin or the user themselves can update
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const user = db.get('users').find({ id }).value();
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Admin accounts are managed exclusively by the EMCY Management owner.
    // (The owner editing their own account is always allowed.)
    if (user.role === 'admin' && !isOwner(req.user) && req.user.id !== id) {
      return res.status(403).json({ message: 'Only the EMCY Management admin can manage administrator accounts.' });
    }

    const { name, email, project, role, password, avatar, joinDate, skills } = req.body;
    const updates = {};

    // EMCY email rule applies when editing an email too
    if (email) {
      const emailCheck = validateEmcyEmail(email);
      if (!emailCheck.ok) {
        return res.status(400).json({ message: emailCheck.error });
      }
      // Prevent duplicate emails (case-insensitive, excluding this user)
      const duplicate = db.get('users')
        .find({ email: emailCheck.email })
        .value();
      if (duplicate && duplicate.id !== id) {
        return res.status(400).json({ message: 'A user with this email already exists.' });
      }
      updates.email = emailCheck.email;
    }

    if (name) updates.name = name;
    if (project) updates.project = project;
    if (avatar !== undefined) updates.avatar = avatar;
    if (joinDate) updates.joinDate = joinDate;
    if (skills !== undefined) updates.skills = skills;

    // Role changes are owner-only (protects the admin/member structure)
    if (role && role !== user.role) {
      if (!isOwner(req.user)) {
        return res.status(403).json({ message: 'Only the EMCY Management admin can change account roles.' });
      }
      updates.role = role;
    }

    // Hash new password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }

    await db.get('users').find({ id }).assign(updates).write();

    const updatedUser = db.get('users').find({ id }).value();
    const { password: _, ...userResponse } = updatedUser;

    res.json({ message: 'User updated successfully.', user: userResponse });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user (admin only)
 */
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const db = await dbReady;
    const { id } = req.params;

    const user = db.get('users').find({ id }).value();
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Prevent deleting yourself
    if (req.user.id === id) {
      return res.status(400).json({ message: 'Cannot delete your own account.' });
    }

    // Admin accounts can only be removed by the EMCY Management owner
    if (user.role === 'admin' && !isOwner(req.user)) {
      return res.status(403).json({ message: 'Only the EMCY Management admin can remove administrator accounts.' });
    }

    // Delete user and their progress
    await db.get('users').remove({ id }).write();
    await db.get('weeklyProgress').remove({ userId: id }).write();

    res.json({ message: 'User and related data deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
