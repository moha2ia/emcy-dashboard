/**
 * Resolve a stored file reference to a usable URL.
 * - Full URLs (http/https/data/blob) pass through untouched.
 * - Server-relative paths like "/uploads/work/file.pdf" resolve to the same
 *   origin, which works in dev (Vite proxies /uploads to the API) and in
 *   production behind the same domain.
 * - Empty/undefined values return '' so callers can falsy-check safely.
 */
export function resolveUrl(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return path;
}

/**
 * Resolve an image (avatar) reference for use inside a CSS url() value.
 */
export function resolveImageUrl(path) {
  const url = resolveUrl(path);
  return url ? `url(${url})` : '';
}
