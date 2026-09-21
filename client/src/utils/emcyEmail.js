/**
 * Single source of truth for EMCY email validation (client copy).
 * Mirrors server/utils/emcyEmail.js - keep the two in sync.
 * The backend always re-validates; this gives instant user feedback.
 */
export const EMCY_DOMAIN = 'emcy.ma';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const EMCY_EMAIL_ERROR = 'Only official @emcy.ma email addresses are allowed.';

export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return { ok: false, email: '' };
  const email = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  return { ok: email.length > 0, email };
}

export function validateEmcyEmail(raw) {
  const { ok, email } = normalizeEmail(raw);
  if (!ok) return { ok: false, email: '', error: EMCY_EMAIL_ERROR };

  if (!EMAIL_REGEX.test(email)) return { ok: false, email, error: EMCY_EMAIL_ERROR };

  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (domain !== EMCY_DOMAIN) return { ok: false, email, error: EMCY_EMAIL_ERROR };

  return { ok: true, email, error: null };
}
