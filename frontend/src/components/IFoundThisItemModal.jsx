import { useState } from 'react';
import { createFoundItem } from '../services/foundItemService';
import './IFoundThisItemModal.css';

const IFoundThisItemModal = ({ lostItem, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    dateFound: '',
    location: '',
    additionalObservations: '',
  });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.dateFound || !form.location) {
      setError('Date Found and Found Location are required.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      // Pre-fill item details from the lost item
      formData.append('itemType', lostItem.itemType || '');
      formData.append('category', lostItem.category || '');
      formData.append('brand', lostItem.brand || '');
      formData.append('color', lostItem.color || '');
      formData.append('model', lostItem.model || '');
      formData.append('description', lostItem.description || '');
      // User-provided fields
      formData.append('location', form.location);
      formData.append('dateFound', form.dateFound);
      formData.append('additionalObservations', form.additionalObservations);
      formData.append('linkedLostItemId', lostItem._id);
      if (image) formData.append('image', image);

      await createFoundItem(formData);
      setSubmitted(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ifi-modal-overlay" onClick={onClose}>
      <div className="ifi-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ifi-modal__close" onClick={onClose} aria-label="Close">✕</button>

        {submitted ? (
          <div className="ifi-modal__success">
            <span className="ifi-modal__success-icon">✅</span>
            <h3>Report Submitted!</h3>
            <p>Your found item report has been created and linked to this lost item. The admin will review the match.</p>
          </div>
        ) : (
          <>
            <div className="ifi-modal__header">
              <h2>I Found This Item</h2>
              <p>Tell us when and where you found it. We'll link it to this lost item report automatically.</p>
            </div>

            <div className="ifi-modal__item-ref">
              <span className="ifi-modal__item-label">Reporting about:</span>
              <strong>{lostItem.itemType || lostItem.category}</strong>
              {lostItem.category && lostItem.itemType && (
                <span className="ifi-modal__item-category">· {lostItem.category}</span>
              )}
            </div>

            {error && <div className="auth-error">{error}</div>}

            <form className="ifi-modal__form" onSubmit={handleSubmit}>
              <label className="form-label">Date Found *</label>
              <input
                type="date"
                className="form-input"
                name="dateFound"
                value={form.dateFound}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                required
              />

              <label className="form-label">Found Location *</label>
              <input
                type="text"
                className="form-input"
                name="location"
                placeholder="e.g. Library, Block B, Main Gate"
                value={form.location}
                onChange={handleChange}
                required
              />

              <label className="form-label">Additional Observations <span className="ifi-modal__optional">(optional)</span></label>
              <textarea
                className="form-input ifi-modal__textarea"
                name="additionalObservations"
                placeholder="Any extra details about the item's condition, where exactly you found it, etc."
                value={form.additionalObservations}
                onChange={handleChange}
                rows={3}
              />

              <label className="form-label">Upload Image <span className="ifi-modal__optional">(optional)</span></label>
              <input
                type="file"
                className="form-input ifi-modal__file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files[0])}
              />

              <div className="ifi-modal__actions">
                <button type="button" className="btn btn--secondary" onClick={onClose} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={loading}>
                  {loading ? 'Submitting…' : 'Submit Found Report'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default IFoundThisItemModal;
