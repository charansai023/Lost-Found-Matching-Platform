import { useState } from 'react';
import { resolveImageUrl, isLegacyImagePath } from '../utils/image';
import './SafeImage.css';

/**
 * SafeImage (Phase 4): renders item images with graceful failure handling.
 * - Legacy /uploads/... paths (permanently unavailable after the Cloudinary
 *   migration) render the placeholder immediately — no doomed network fetch.
 * - Cloudinary/absolute URLs render normally; any load error (expired asset,
 *   transient failure) swaps to the placeholder instead of a broken image.
 * - `null`/empty src renders the placeholder directly.
 *
 * The placeholder text distinguishes "never had an image" from "image no
 * longer available (legacy record)" without exposing internals.
 */
const SafeImage = ({ src, alt = '', className = '', placeholderClassName = '' }) => {
  const [loadFailed, setLoadFailed] = useState(false);

  const resolved = resolveImageUrl(src);
  const isLegacy = isLegacyImagePath(src);

  if (!resolved || isLegacy || loadFailed) {
    return (
      <div className={`safe-image__placeholder ${placeholderClassName}`} role="img" aria-label={alt || 'No image'}>
        <span className="safe-image__placeholder-icon">{isLegacy ? '🗂️' : '📷'}</span>
        <span className="safe-image__placeholder-text">
          {!resolved ? 'No Image' : isLegacy ? 'Image no longer available (legacy record)' : 'Image unavailable'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setLoadFailed(true)}
    />
  );
};

export default SafeImage;
