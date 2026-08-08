import { useState, useEffect } from 'react';
import { createClaim } from '../services/claimService';
import { getMyLostItems } from '../services/myService';
import './ClaimModal.css';

const ClaimModal = ({ foundItem, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    lostItemId: '',
    uniqueMarks: '',
    ownershipDetails: '',
    approximateDateLost: '',
  });
  const [image, setImage] = useState(null);
  const [myLostItems, setMyLostItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchMyLostItems = async () => {
      try {
        const result = await getMyLostItems();
        const openItems = (result.data.lostItems || []).filter(
          (i) => i.status === 'Pending' || i.status === 'Matched'
        );
        setMyLostItems(openItems);
      } catch {
        setError('Could not load your lost items. Please try again.');
      } finally {
        setLoadingItems(false);
      }
    };
    fetchMyLostItems();
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.uniqueMarks.trim()) { setError('Unique identifying marks are required.'); return; }
    if (!form.ownershipDetails.trim()) { setError('Additional ownership details are required.'); return; }
    if (!form.approximateDateLost) { setError('Approximate date lost is required.'); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('foundItemId', foundItem._id);
      formData.append('lostItemId', form.lostItemId);
      formData.append('uniqueMarks', form.uniqueMarks);
      formData.append('ownershipDetails', form.ownershipDetails);
      formData.append('approximateDateLost', form.approximateDateLost);
      if (image) formData.append('image', image);

      await createClaim(formData);
      setSubmitted(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit claim. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="claim-modal-overlay" onClick={onClose}>
      <div className="claim-modal" onClick={(e) => e.stopPropagation()}>
        <button className="claim-modal__close" onClick={onClose} aria-label="Close">✕</button>

        {submitted ? (
          <div className="claim-modal__success">
            <span className="claim-modal__success-icon">📬</span>
            <h3>Claim Submitted!</h3>
            <p>Your ownership claim has been sent to the admin for review. You can track its status in My Reports → My Claims.</p>
          </div>
        ) : (
          <>
            <div className="claim-modal__header">
              <h2>This Is My Item</h2>
              <p>Prove ownership by providing identifying details. An admin will review and verify your claim.</p>
            </div>

            <div className="claim-modal__item-ref">
              <span className="claim-modal__item-label">Claiming:</span>
              <strong>{foundItem.itemType || foundItem.category}</strong>
              {foundItem.location && (
                <span className="claim-modal__item-location">📍 {foundItem.location}</span>
              )}
            </div>

            {error && <div className="auth-error">{error}</div>}

            <form className="claim-modal__form" onSubmit={handleSubmit}>
              <label className="form-label">Which of your lost items is this? <span className="claim-modal__optional">(optional)</span></label>
              {loadingItems ? (
                <p className="claim-modal__loading">Loading your lost items…</p>
              ) : (
                <select
                  className="form-input"
                  name="lostItemId"
                  value={form.lostItemId}
                  onChange={handleChange}
                >
                  <option value="">— Direct Claim (No lost report) —</option>
                  {myLostItems.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.itemType || item.category} · {item.location} ·{' '}
                      {new Date(item.dateLost).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              )}

              <label className="form-label">Unique Identifying Marks *</label>
              <textarea
                className="form-input claim-modal__textarea"
                name="uniqueMarks"
                placeholder="Scratches, engravings, stickers, serial numbers, damage marks, etc."
                value={form.uniqueMarks}
                onChange={handleChange}
                rows={3}
                required
              />

              <label className="form-label">Additional Ownership Details *</label>
              <textarea
                className="form-input claim-modal__textarea"
                name="ownershipDetails"
                placeholder="Purchase receipt info, registered name, what's stored inside, etc."
                value={form.ownershipDetails}
                onChange={handleChange}
                rows={3}
                required
              />

              <label className="form-label">Approximate Date Lost *</label>
              <input
                type="date"
                className="form-input"
                name="approximateDateLost"
                value={form.approximateDateLost}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                required
              />

              <label className="form-label">
                Supporting Image <span className="claim-modal__optional">(optional)</span>
              </label>
              <input
                type="file"
                className="form-input claim-modal__file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files[0])}
              />

              <div className="claim-modal__actions">
                <button type="button" className="btn btn--secondary" onClick={onClose} disabled={loading}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={loading || loadingItems}
                >
                  {loading ? 'Submitting…' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimModal;
