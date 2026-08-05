import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLostItem } from '../services/lostItemService';
import './ReportItem.css';

const CATEGORY_OPTIONS = [
  'Electronics', 'Bags', 'Wallets', 'Jewelry', 'Documents',
  'Clothing', 'Keys', 'Books', 'Sports Equipment', 'Other',
];

const ReportLostItem = () => {
  const [formData, setFormData] = useState({
    itemType: '',
    category: '',
    brand: '',
    color: '',
    model: '',
    description: '',
    dateLost: '',
    location: '',
    // Private fields
    uniqueMarks: '',
    ownershipDetails: '',
  });
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => payload.append(key, value));
      if (image) {
        payload.append('image', image);
      }

      await createLostItem(payload);
      navigate('/my-reports');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit lost item report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-page">
      <h1>Report a Lost Item</h1>
      <p className="report-page__subtitle">Give as much detail as possible to improve match accuracy</p>

      {error && <div className="auth-error">{error}</div>}

      <form className="report-form" onSubmit={handleSubmit}>
        {/* ── Public Information ── */}
        <div className="report-section-header">
          <span className="report-section-icon">📋</span>
          <div>
            <h3>Public Information</h3>
            <p>Visible to all users to help identify the item</p>
          </div>
        </div>

        <label className="form-label">Item Type <span className="form-required">*</span></label>
        <input
          type="text"
          name="itemType"
          className="form-input"
          value={formData.itemType}
          onChange={handleChange}
          placeholder="e.g. Laptop, Wallet, Backpack, Keys"
          required
        />

        <label className="form-label">Category <span className="form-required">*</span></label>
        <select name="category" className="form-input" value={formData.category} onChange={handleChange} required>
          <option value="">Select a category</option>
          {CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <div className="form-row">
          <div>
            <label className="form-label">Brand <span className="form-optional">(optional)</span></label>
            <input
              type="text"
              name="brand"
              className="form-input"
              value={formData.brand}
              onChange={handleChange}
              placeholder="e.g. Apple, Nike, Fossil"
            />
          </div>
          <div>
            <label className="form-label">Color</label>
            <input
              type="text"
              name="color"
              className="form-input"
              value={formData.color}
              onChange={handleChange}
              placeholder="e.g. Black, Red, Silver"
            />
          </div>
        </div>

        <label className="form-label">Model <span className="form-optional">(optional)</span></label>
        <input
          type="text"
          name="model"
          className="form-input"
          value={formData.model}
          onChange={handleChange}
          placeholder="e.g. iPhone 15, MacBook Pro M3"
        />

        <label className="form-label">Description</label>
        <textarea
          name="description"
          className="form-textarea"
          value={formData.description}
          onChange={handleChange}
          placeholder="Any other visible details about the item..."
        />

        <label className="form-label">Photo <span className="form-optional">(optional)</span></label>
        <input
          type="file"
          accept="image/*"
          className="form-file-input"
          onChange={(e) => setImage(e.target.files[0])}
        />

        <div className="form-row">
          <div>
            <label className="form-label">Date Lost</label>
            <input
              type="date"
              name="dateLost"
              className="form-input"
              value={formData.dateLost}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="form-label">Lost Location <span className="form-required">*</span></label>
            <input
              type="text"
              name="location"
              className="form-input"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. Central Library, 2nd Floor"
              required
            />
          </div>
        </div>

        {/* ── Private Verification Information ── */}
        <div className="report-section-header report-section-header--private">
          <span className="report-section-icon">🔒</span>
          <div>
            <h3>Private Verification Details</h3>
            <p>Only visible to you and the Admin — never shown to other users</p>
          </div>
        </div>

        <label className="form-label">Unique Identifying Marks</label>
        <textarea
          name="uniqueMarks"
          className="form-textarea form-textarea--private"
          value={formData.uniqueMarks}
          onChange={handleChange}
          placeholder="e.g. Scratch on the back, sticker on cover, engraved initials, serial number..."
        />

        <label className="form-label">Ownership Details</label>
        <textarea
          name="ownershipDetails"
          className="form-textarea form-textarea--private"
          value={formData.ownershipDetails}
          onChange={handleChange}
          placeholder="e.g. Receipt number, registered email, purchase details, inside label..."
        />

        <button type="submit" className="btn btn--primary form-submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Lost Item Report'}
        </button>
      </form>
    </div>
  );
};

export default ReportLostItem;
