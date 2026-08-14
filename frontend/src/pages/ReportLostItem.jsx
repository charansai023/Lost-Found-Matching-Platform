import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createLostItem, getLostItemById, updateLostItem } from '../services/lostItemService';
import './ReportItem.css';

const CATEGORY_OPTIONS = [
  'Electronics', 'Bags', 'Wallets', 'Jewelry', 'Documents',
  'Clothing', 'Keys', 'Books', 'Sports Equipment', 'Other',
];

const ReportLostItem = ({ isEditMode = false }) => {
  const { id } = useParams();
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

  useEffect(() => {
    if (isEditMode && id) {
      const fetchItem = async () => {
        try {
          const res = await getLostItemById(id);
          const item = res.data.lostItem;
          setFormData({
            itemType: item.itemType || '',
            category: item.category || '',
            brand: item.brand || '',
            color: item.color || '',
            model: item.model || '',
            description: item.description || '',
            dateLost: item.dateLost ? item.dateLost.split('T')[0] : '',
            location: item.location || '',
            uniqueMarks: item.uniqueMarks || '',
            ownershipDetails: item.ownershipDetails || '',
          });
        } catch (err) {
          setError('Failed to load item for editing.');
        }
      };
      fetchItem();
    }
  }, [isEditMode, id]);

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

      if (isEditMode) {
        await updateLostItem(id, payload);
      } else {
        await createLostItem(payload);
      }
      navigate('/my-reports');
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'submit'} lost item report`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-page">
      <h1>{isEditMode ? 'Edit Lost Item Report' : 'Report a Lost Item'}</h1>
      <p className="report-page__subtitle">
        {isEditMode ? 'Update the details of your lost item.' : 'Give as much detail as possible to improve match accuracy'}
      </p>

      {error && <div className="auth-error">{error}</div>}

      <form className="report-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Basic Details</h3>
          <div className="form-group">
            <label>Item Name/Title *</label>
            <input
              type="text"
              name="itemType"
              value={formData.itemType}
              onChange={handleChange}
              placeholder="e.g. iPhone 13, Blue Backpack"
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Category *</label>
              <select name="category" value={formData.category} onChange={handleChange} required>
                <option value="">Select Category</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Brand</label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g. Apple, Nike"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Color</label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                placeholder="e.g. Black, Navy Blue"
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="e.g. Pro Max, Air Force 1"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Provide a general description of the item..."
              rows="3"
            ></textarea>
          </div>

          <div className="form-group">
            <label>Image (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>When & Where</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Approx. Date Lost *</label>
              <input
                type="date"
                name="dateLost"
                value={formData.dateLost}
                onChange={handleChange}
                max={new Date().toLocaleDateString('en-CA')}
                required
              />
            </div>
            <div className="form-group">
              <label>Location Lost *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Library 2nd Floor, Bus 42"
                required
              />
            </div>
          </div>
        </div>

        <div className="form-section form-section--private">
          <div className="private-header">
            <span className="private-icon">🔒</span>
            <div>
              <h3>Private Verification Details</h3>
              <p>Only visible to Admin. Used to verify ownership when claimed.</p>
            </div>
          </div>
          
          <div className="form-group">
            <label>Unique Marks / Serial Number</label>
            <textarea
              name="uniqueMarks"
              value={formData.uniqueMarks}
              onChange={handleChange}
              placeholder="e.g. Scratch on top left, IMEI number, engraving..."
              rows="2"
            ></textarea>
          </div>
          
          <div className="form-group">
            <label>Specific Ownership Proof</label>
            <textarea
              name="ownershipDetails"
              value={formData.ownershipDetails}
              onChange={handleChange}
              placeholder="e.g. I have the receipt, I can unlock it, wallpaper is a dog..."
              rows="2"
            ></textarea>
          </div>
        </div>

        <button type="submit" className="btn btn--primary form-submit" disabled={loading}>
          {loading ? 'Submitting...' : isEditMode ? 'Update Lost Item' : 'Submit Lost Item Report'}
        </button>
      </form>
    </div>
  );
};

export default ReportLostItem;
