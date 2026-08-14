import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import './ItemCard.css';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace('/api', '');

/**
 * Reusable card for displaying a lost or found item in a listing.
 * Shows minimal info only (image, type, category, location, date).
 * Clicking the card navigates to the dedicated detail page.
 * `showActions` enables edit/delete for use in MyReports.
 */
const ItemCard = ({ item, type = 'lost', onEdit, onDelete, showActions = false }) => {
  const dateLabel = type === 'lost' ? 'Date Lost' : 'Date Found';
  const dateValue = type === 'lost' ? item.dateLost : item.dateFound;
  const detailPath = `/${type}-items/${item._id}`;
  const imageUrl = item.image ? (item.image.startsWith('http') ? item.image : `${API_ORIGIN}${item.image}`) : null;

  return (
    <div className="item-card">
      <Link to={detailPath} className="item-card__link">
        <div className="item-card__image-wrapper">
          {imageUrl ? (
            <img src={imageUrl} alt={item.itemType || item.category} className="item-card__image" />
          ) : (
            <div className="item-card__image-placeholder">No Image</div>
          )}
          <span className="item-card__status-overlay">
            <StatusBadge status={item.status} />
            {item.matchingStatus === 'processing' && (
              <span style={{ fontSize: '11px', background: '#6366f1', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px', fontWeight: 600 }}>
                ⏳ AI Matching...
              </span>
            )}
          </span>
        </div>

        <div className="item-card__body">
          <h3 className="item-card__title">{item.itemType || item.category}</h3>
          <p className="item-card__detail">
            <strong>Category:</strong> {item.category}
          </p>
          <p className="item-card__detail">
            <strong>Location:</strong> {item.location || '—'}
          </p>
          <p className="item-card__detail">
            <strong>{dateLabel}:</strong>{' '}
            {dateValue ? new Date(dateValue).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      </Link>

      {showActions && (
        <div className="item-card__actions">
          <button className="btn btn--secondary" onClick={() => onEdit?.(item)}>
            Edit
          </button>
          <button className="btn btn--danger" onClick={() => onDelete?.(item._id)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ItemCard;
