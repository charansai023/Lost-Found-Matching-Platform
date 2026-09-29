import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLostItemById } from '../services/lostItemService';
import useAuth from '../hooks/useAuth';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import IFoundThisItemModal from '../components/IFoundThisItemModal';
import SafeImage from '../components/SafeImage';
import './ItemDetail.css';


const LostItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const result = await getLostItemById(id);
        setItem(result.data.lostItem);
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

  // The owner/reporter of a lost item cannot report it as found themselves —
  // the backend rejects this ("You cannot report finding an item that you
  // originally reported as lost"), so hide the action entirely for them.
  // Auth responses expose the user's id as `id` (see authController), while a
  // populated item.user exposes `_id` — handle both shapes when comparing.
  const currentUserId = user?.id || user?._id;
  const isOwner = Boolean(
    currentUserId &&
      item?.user &&
      String(item.user?._id || item.user) === String(currentUserId)
  );

  return (
    <div className="item-detail-page">
      <button className="item-detail__back-btn" onClick={() => navigate(-1)}>
        ← Back to Lost Items
      </button>

      <div className="item-detail-card">
        {/* Image */}
        <div className="item-detail__image-wrapper">
          <SafeImage
            src={item?.image}
            alt={item?.itemType || item?.category}
            className="item-detail__image"
            placeholderClassName="item-detail__image-placeholder"
          />
          <div className="item-detail__status-overlay">
            <StatusBadge status={item.status} size="md" />
          </div>
        </div>

        {/* Body */}
        <div className="item-detail__body">
          <div className="item-detail__title-row">
            <h1 className="item-detail__title">{item.itemType || item.category}</h1>
            <span className="item-detail__type-tag">Lost Item</span>
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
              <span className="item-detail__field-label">Lost Location</span>
              <span className="item-detail__field-value">📍 {item.location || '—'}</span>
            </div>
            <div className="item-detail__field">
              <span className="item-detail__field-label">Date Lost</span>
              <span className="item-detail__field-value">
                {item.dateLost ? new Date(item.dateLost).toLocaleDateString() : '—'}
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

          {!isOwner && (
            <div className="item-detail__action-section">
              <div className="item-detail__action-info">
                <strong>Did you find this item?</strong>
                <p>Click below to report it found. We'll automatically link it to this report and notify the admin.</p>
              </div>
              <button
                className="btn btn--primary item-detail__action-btn"
                onClick={() => setShowModal(true)}
              >
                🔍 I Found This Item
              </button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <IFoundThisItemModal
          lostItem={item}
          onClose={() => setShowModal(false)}
          onSuccess={() => navigate('/found-items')}
        />
      )}
    </div>
  );
};

export default LostItemDetail;
