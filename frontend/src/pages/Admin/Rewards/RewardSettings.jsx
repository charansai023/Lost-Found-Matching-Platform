import React, { useState, useEffect } from 'react';
import rewardService from '../../../services/rewardService';

const RewardSettings = () => {
  const [pointValues, setPointValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await rewardService.getRewardConfig();
      // Ensure defaults if empty
      const config = response.data.config.pointValues || {
        'ID Card': 40,
        'Keys': 30,
        'Wallet': 100,
        'Mobile': 120,
        'Laptop': 150,
        'Others': 50,
      };
      setPointValues(config);
    } catch (err) {
      setMessage({ text: 'Failed to load point configuration.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (category, value) => {
    setPointValues(prev => ({
      ...prev,
      [category]: Number(value)
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await rewardService.updateRewardConfig(pointValues);
      setMessage({ text: 'Point configuration saved successfully.', type: 'success' });
    } catch (err) {
      setMessage({ text: 'Failed to save configuration.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-transition">Loading...</div>;

  return (
    <div className="dashboard page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#111827', margin: 0 }}>⚙️ Reward Points Configuration</h1>
      </div>
      
      {message.text && (
        <div className={`auth-error ${message.type === 'success' ? 'auth-success' : ''}`} style={message.type === 'success' ? { backgroundColor: '#dcfce7', color: '#166534', marginBottom: '16px', padding: '12px', borderRadius: '8px' } : {}}>
          {message.text}
        </div>
      )}

      <div className="stat-card" style={{ maxWidth: '600px', padding: '32px' }}>
        <p style={{ marginBottom: '24px', color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>
          Set the default points awarded to finders when a lost item is successfully returned. Categories not listed here will fallback to the "Others" value.
        </p>

        <form onSubmit={handleSave}>
          <ul className="dashboard__list">
            {Object.entries(pointValues).map(([category, points]) => (
              <li key={category} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                <label style={{ flex: '1', fontWeight: '600', color: '#334155' }}>{category}</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={points}
                  onChange={(e) => handleInputChange(category, e.target.value)}
                  style={{ width: '120px', marginBottom: 0, padding: '8px 12px' }}
                  min="0"
                  required
                />
              </li>
            ))}
          </ul>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RewardSettings;
