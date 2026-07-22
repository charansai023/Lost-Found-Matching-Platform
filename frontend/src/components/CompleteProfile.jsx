import { useState } from 'react';
import useAuth from '../hooks/useAuth';
import './CompleteProfile.css';

const CompleteProfile = () => {
  const { user, completeUserProfile, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await completeUserProfile(fullName, email, mobileNumber);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete profile details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="complete-profile-overlay">
      <div className="complete-profile-card">
        <h2>Complete Your Profile</h2>
        <p>Before accessing any features of the Lost & Found platform, please complete your profile details. These details are only visible to the Admin.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="complete-profile-form">
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="mobileNumber">Mobile Number</label>
            <input
              id="mobileNumber"
              type="tel"
              className="form-input"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="e.g. +1234567890"
              required
            />
          </div>

          <div className="complete-profile-actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving...' : 'Submit Profile'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={logout}>
              Cancel / Logout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
