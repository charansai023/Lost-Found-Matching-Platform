import { useEffect, useState } from 'react';
import { getMyLostItems, getMyFoundItems } from '../services/myService';
import useAuth from '../hooks/useAuth';
import Loader from '../components/Loader';
import './Profile.css';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [myLostCount, setMyLostCount] = useState(0);
  const [myFoundCount, setMyFoundCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [lostResult, foundResult] = await Promise.all([getMyLostItems(), getMyFoundItems()]);
        setMyLostCount(lostResult.data.lostItems.length);
        setMyFoundCount(foundResult.data.foundItems.length);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadCounts();
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await updateProfile(name);
      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-card__avatar">{user?.name?.charAt(0).toUpperCase()}</div>

        {success && <div className="profile-card__success">{success}</div>}
        {error && <div className="auth-error">{error}</div>}

        {isEditing ? (
          <form onSubmit={handleSave}>
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />

            <div className="profile-card__edit-actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setIsEditing(false);
                  setName(user?.name || '');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1>{user?.name}</h1>
            <p className="profile-card__email">{user?.email}</p>
            {user?.role === 'admin' && <span className="role-badge role-badge--admin">admin</span>}
            <button className="btn btn--secondary profile-card__edit-btn" onClick={() => setIsEditing(true)}>
              Edit Name
            </button>
          </>
        )}

        <div className="profile-card__stats">
          <div>
            <span className="profile-card__stat-value">{myLostCount}</span>
            <span className="profile-card__stat-label">Lost Reports</span>
          </div>
          <div>
            <span className="profile-card__stat-value">{myFoundCount}</span>
            <span className="profile-card__stat-label">Found Reports</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
