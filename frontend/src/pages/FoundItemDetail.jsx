import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFoundItemById } from '../services/foundItemService';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import ClaimModal from '../components/ClaimModal';
import './ItemDetail.css';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace('/api', '');

const FoundItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const result = await getFoundItemById(id);
        setItem(result.data.foundItem);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load item details.');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id]);

  if (loading) return <Loader />;

  if (error) {
    return (
      <div className="item-detail-page">
        <div className="auth-error">{error}</div>
        <button className="btn btn--secondary" onClick={() => navigate(-1)}>← Go Back</button>
      </div>
    );
  }

  const imageUrl = item.image ? `${API_ORIGIN}${item.image}` : null;

  return (
    <div className="item-detail-page">
      <button className="item-detail__back-btn" onClick={() => navigate(-1)}>
        ← Back to Found Items
      </button>

      <div className="item-detail-card">
        {/* Image */}
        <div className="item-detail__image-wrapper">
          {imageUrl ? (
            <img src={imageUrl} alt={item.itemType || item.category} className="item-detail__image" />
          ) : (
            <div className="item-detail__image-placeholder">No Image Available</div>
          )}
          <div className="item-detail__status-overlay">
            <StatusBadge status={item.status} size="md" />
          </div>
        </div>

        {/* Body */}
        <div className="item-detail__body">
          <div className="item-detail__title-row">
            <h1 className="item-detail__title">{item.itemType || item.category}</h1>
            <span className="item-detail__type-tag item-detail__type-tag--found">Found Item</span>
          </div>

          <div className="item-detail__grid">
            <div className="item-detail__field">
              <span className="item-detail__field-label">Category</span>
              <span className="item-detail__field-value">{item.category || '—'}</span>
            </div>
            {item.brand && (
              <div className="item-detail__field">
                <span className="item-detail__field-label">Brand</span>
                <span className="item-detail__field-value">{item.brand}</span>
              </div>
            )}
            {item.color && (
              <div className="item-detail__field">
                <span className="item-detail__field-label">Color</span>
                <span className="item-detail__field-value">{item.color}</span>
              </div>
            )}
            {item.model && (
              <div className="item-detail__field">
                <span className="item-detail__field-label">Model</span>
                <span className="item-detail__field-value">{item.model}</span>
              </div>
            )}
            <div className="item-detail__field">
              <span className="item-detail__field-label">Found Location</span>
              <span className="item-detail__field-value">📍 {item.location || '—'}</span>
            </div>
            <div className="item-detail__field">
              <span className="item-detail__field-label">Date Found</span>
              <span className="item-detail__field-value">
                {item.dateFound ? new Date(item.dateFound).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="item-detail__field">
              <span className="item-detail__field-label">Status</span>
              <span className="item-detail__field-value">
                <StatusBadge status={item.status} />
              </span>
            </div>
          </div>

          {item.description && (
            <div className="item-detail__description-section">
              <span className="item-detail__field-label">Description</span>
              <p className="item-detail__description">{item.description}</p>
            </div>
          )}

          <div className="item-detail__action-section">
            <div className="item-detail__action-info">
              <strong>Is this your item?</strong>
              <p>Click below to submit an ownership claim. Provide unique details that prove this belongs to you. Admin will review your claim.</p>
            </div>
            <button
              className="btn btn--primary item-detail__action-btn"
              onClick={() => setShowModal(true)}
            >
              ✋ This Is My Item
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <ClaimModal
          foundItem={item}
          onClose={() => setShowModal(false)}
          onSuccess={() => navigate('/my-reports')}
        />
      )}
    </div>
  );
};

export default FoundItemDetail;
