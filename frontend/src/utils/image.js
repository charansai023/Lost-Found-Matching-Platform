const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace('/api', '');

/**
 * Image URL resolution (Phase 4).
 * - Absolute URLs (Cloudinary, new uploads) pass through untouched.
 * - Legacy relative paths (/uploads/... from the old ephemeral Render
 *   filesystem) are resolved against the API origin for completeness, but
 *   they are KNOWN-UNAVAILABLE — see isLegacyImagePath.
 */
export const resolveImageUrl = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return `${API_ORIGIN}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};

/**
 * Detects legacy /uploads/... references created before the Cloudinary
 * migration. Those files lived on Render's ephemeral filesystem and are
 * permanently unavailable — callers should show a graceful placeholder
 * instead of attempting (and failing) to load them.
 */
export const isLegacyImagePath = (imagePath) =>
  Boolean(imagePath && typeof imagePath === 'string' && imagePath.startsWith('/uploads/'));
