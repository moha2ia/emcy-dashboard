const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/db');
const { auth, adminOnly, ownerOnly, isOwner } = require('../middleware/auth');
const { validateEmcyEmail } = require('../utils/emcyEmail');

/**
 * POST /api/auth/register
 * Register a new member (admin only)
 */
router.post('/register', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, project, avatar, joinDate, skills } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    // EMCY email rule: normalize + format + exact @emcy.ma domain
    const emailCheck = validateEmcyEmail(email);
    if (!emailCheck.ok) {
      return res.status(400).json({ message: emailCheck.error });
    }

    // Creating an ADMIN account requires the EMCY Management owner
    if ((role || 'member') === 'admin' && !isOwner(req.user)) {
      return res.status(403).json({ message: 'Only the EMCY Management admin can create administrator accounts.' });
    }

    // Check if user already exists
    const existingUser = db.get('users').find({ email: emailCheck.email }).value();
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      id: uuidv4(),
      name,
      email: emailCheck.email,
      password: hashedPassword,
      role: role || 'member',
      project: project || '',
      avatar: avatar || null,
      joinDate: joinDate || new Date().toISOString().split('T')[0],
      skills: skills || '',
      createdAt: new Date().toISOString(),
    };

    db.get('users').push(newUser).write();

    const { password: _, ...userResponse } = newUser;
    res.status(201).json({ message: 'User registered successfully.', user: userResponse });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Normalize the same way as at registration so lookup always matches
    const { normalizeEmail } = require('../utils/emcyEmail');
    const normalized = normalizeEmail(email);
    const user = db.get('users').find({ email: normalized.email }).value();
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    const { password: _, ...userResponse } = user;
    res.json({
      message: 'Login successful.',
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * GET /api/auth/me
 * Get currently authenticated user
 */
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
