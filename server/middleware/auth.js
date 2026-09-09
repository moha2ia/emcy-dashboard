const jwt = require('jsonwebtoken');
const { dbReady } = require('../config/db');

/**
 * Verify JWT token and attach user to request
 */
async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = await dbReady;
    const user = db.get('users').find({ id: decoded.id }).value();

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    // Attach user (without password) to request
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

/**
 * Restrict route to admin role only
 */
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
}

/**
 * The Owner is the admin whose major/project is exactly "EMCY Management".
 * Only the Owner can create, edit or remove ADMIN accounts (and change roles).
 * Other admins keep full day-to-day powers over members and tasks.
 */
const OWNER_MAJOR = 'emcy management';

function isOwner(user) {
  return !!user && user.role === 'admin' && (user.project || '').trim().toLowerCase() === OWNER_MAJOR;
}

/**
 * Route guard: owner-only operations (managing admin accounts, changing roles)
 */
function ownerOnly(req, res, next) {
  if (!isOwner(req.user)) {
    return res.status(403).json({ message: 'Only the EMCY Management admin can manage administrator accounts.' });
  }
  next();
}

module.exports = { auth, adminOnly, ownerOnly, isOwner, OWNER_MAJOR };
