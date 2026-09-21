/**
 * Single source of truth for EMCY email validation.
 * The same rules apply to every account (admin and member).
 * A mirrored copy lives in client/src/utils/emcyEmail.js - keep the two in sync.
 */
const EMCY_DOMAIN = 'emcy.ma';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMCY_EMAIL_ERROR = 'Only official @emcy.ma email addresses are allowed.';

/**
 * Normalize an email: trim, collapse inner spaces, lowercase.
 * Returns { ok, email } - email is '' when normalization fails.
 * Note: spaces are only stripped at the EDGES (paste artifacts). A space
 * inside the address is a typo and is rejected by the format check.
 */
function normalizeEmail(raw) {
  if (typeof raw !== 'string') return { ok: false, email: '' };
  const email = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  return { ok: email.length > 0, email };
}

/**
 * Validate an EMCY email.
 * Returns { ok, email, error } - email is the normalized value (usable for storage).
 *
 * Rules:
 *  1. must be a syntactically valid email
 *  2. domain must be EXACTLY emcy.ma (no subdomains, no lookalike domains)
 */
function validateEmcyEmail(raw) {
  const { ok, email } = normalizeEmail(raw);
  if (!ok) return { ok: false, email: '', error: EMCY_EMAIL_ERROR };

  if (!EMAIL_REGEX.test(email)) return { ok: false, email, error: EMCY_EMAIL_ERROR };

  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (domain !== EMCY_DOMAIN) return { ok: false, email, error: EMCY_EMAIL_ERROR };

  return { ok: true, email, error: null };
}

module.exports = { validateEmcyEmail, normalizeEmail, EMCY_EMAIL_ERROR, EMCY_DOMAIN };
