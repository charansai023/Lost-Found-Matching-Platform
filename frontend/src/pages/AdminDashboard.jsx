import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getPlatformStats,
  getAllUsersAdmin,
  getAllLostItemsAdmin,
  getAllFoundItemsAdmin,
  getAllMatchesAdmin,
  verifyMatchAdmin,
  rejectMatchAdmin,
  markMatchReturnedAdmin,
  deleteLostItemAdmin,
  deleteFoundItemAdmin,
  getAllClaimsAdmin,
  verifyClaimAdmin,
  rejectClaimAdmin,
} from '../services/adminService';
import StatusBadge from '../components/StatusBadge';
import MatchBadge from '../components/MatchBadge';
import Loader from '../components/Loader';
import useAuth from '../hooks/useAuth';
import './AdminDashboard.css';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace('/api', '');
const imageUrl = (path) => (path ? `${API_ORIGIN}${path}` : null);

// ─────────────────────────────────────────────
// Sub-pages rendered inside the admin layout
// ─────────────────────────────────────────────

const Overview = ({ stats }) => {
  if (!stats) return <Loader />;
  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥' },
    { label: 'Lost Reports', value: stats.totalLost, icon: '🔍' },
    { label: 'Found Reports', value: stats.totalFound, icon: '📦' },
    { label: 'Total Matches', value: stats.totalMatches, icon: '🔗' },
    { label: 'Pending Matches', value: stats.pendingMatches, icon: '⏳', highlight: true },
    { label: 'Verified Matches', value: stats.verifiedMatches, icon: '✅' },
    { label: 'Items Returned', value: stats.returnedMatches, icon: '🏠' },
    { label: 'High Confidence', value: stats.highMatches, icon: '⭐', highlight: true },
  ];
  return (
    <div>
      <div className="admin-stats-grid">
        {cards.map((c) => (
          <div key={c.label} className={`stat-card ${c.highlight ? 'stat-card--highlight' : ''}`}>
            <span className="stat-card__icon">{c.icon}</span>
            <span className="stat-card__value">{c.value}</span>
            <span className="stat-card__label">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const UsersTab = ({ users }) => (
  <div className="admin-table-wrapper">
    <table className="admin-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Login Email</th>
          <th>Full Name</th>
          <th>Contact Email</th>
          <th>Mobile</th>
          <th>Role</th>
          <th>Joined</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u._id}>
            <td>{u.name}</td>
            <td>{u.email}</td>
            <td>{u.fullName || <span className="admin-muted">—</span>}</td>
            <td>{u.profileEmail || <span className="admin-muted">—</span>}</td>
            <td>{u.mobileNumber || <span className="admin-muted">—</span>}</td>
            <td>
              <span className={`role-badge role-badge--${u.role}`}>{u.role}</span>
            </td>
            <td>{new Date(u.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const LostItemsTab = ({ items, onDelete }) => (
  <div className="admin-table-wrapper">
    <table className="admin-table">
      <thead>
        <tr>
          <th>Item Type</th>
          <th>Category</th>
          <th>Color</th>
          <th>Location</th>
          <th>Reported By</th>
          <th>Status</th>
          <th>Unique Marks</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item._id}>
            <td><strong>{item.itemType || '—'}</strong></td>
            <td>{item.category}</td>
            <td>{item.color || '—'}</td>
            <td>{item.location}</td>
            <td>{item.user?.name || 'Unknown'}</td>
            <td><StatusBadge status={item.status} /></td>
            <td>
              {item.uniqueMarks ? (
                <span className="admin-private-field">{item.uniqueMarks}</span>
              ) : (
                <span className="admin-muted">—</span>
              )}
            </td>
            <td>
              <button className="btn btn--danger" onClick={() => onDelete(item._id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const FoundItemsTab = ({ items, onDelete }) => (
  <div className="admin-table-wrapper">
    <table className="admin-table">
      <thead>
        <tr>
          <th>Item Type</th>
          <th>Category</th>
          <th>Color</th>
          <th>Location</th>
          <th>Finder</th>
          <th>Status</th>
          <th>Unique Marks</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item._id}>
            <td><strong>{item.itemType || '—'}</strong></td>
            <td>{item.category}</td>
            <td>{item.color || '—'}</td>
            <td>{item.location}</td>
            <td>{item.user?.name || 'Unknown'}</td>
            <td><StatusBadge status={item.status} /></td>
            <td>
              {item.uniqueMarks ? (
                <span className="admin-private-field">{item.uniqueMarks}</span>
              ) : (
                <span className="admin-muted">—</span>
              )}
            </td>
            <td>
              <button className="btn btn--danger" onClick={() => onDelete(item._id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── Match Verification Panel ──
const MatchCard = ({ match, onVerify, onReject, onMarkReturned }) => {
  const [expanded, setExpanded] = useState(false);
  const { lostItem, foundItem, score, matchLevel, matchedFields, status } = match;

  return (
    <div className={`admin-match-card ${status === 'Rejected' ? 'admin-match-card--rejected' : ''} ${status === 'Returned' ? 'admin-match-card--returned' : ''}`}>
      {/* Summary Row (clickable to expand) */}
      <button className="admin-match-card__summary" onClick={() => setExpanded(!expanded)}>
        <div className="admin-match-row__items">
          <div>
            <strong>Lost:</strong> {lostItem?.itemType || lostItem?.category} &nbsp;
            <span className="admin-muted">({lostItem?.user?.name})</span>
          </div>
          <div>
            <strong>Found:</strong> {foundItem?.itemType || foundItem?.category} &nbsp;
            <span className="admin-muted">({foundItem?.user?.name})</span>
          </div>
        </div>

        <div className="admin-match-row__center">
          <MatchBadge score={score} status={matchLevel} />
          <StatusBadge status={status} />
        </div>

        <span className="admin-match-card__chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded Detail — side-by-side */}
      {expanded && (
        <div className="admin-match-card__detail">
          {/* Three-column layout: Lost | Summary | Found */}
          <div className="admin-match-panels">
            {/* LEFT — Lost Item */}
            <div className="admin-panel">
              <div className="admin-panel__label admin-panel__label--lost">📋 Lost Report</div>
              {imageUrl(lostItem?.image) ? (
                <img src={imageUrl(lostItem.image)} alt="" className="admin-panel__image" />
              ) : (
                <div className="admin-panel__image-placeholder">No Image</div>
              )}
              <div className="admin-panel__info-grid">
                <span className="admin-panel__key">Owner</span>
                <span className="admin-panel__val">{lostItem?.user?.name}</span>
                <span className="admin-panel__key">Email</span>
                <span className="admin-panel__val">{lostItem?.user?.email}</span>
                <span className="admin-panel__key">Item Type</span>
                <span className="admin-panel__val">{lostItem?.itemType || '—'}</span>
                <span className="admin-panel__key">Category</span>
                <span className="admin-panel__val">{lostItem?.category}</span>
                {lostItem?.color && <><span className="admin-panel__key">Color</span><span className="admin-panel__val">{lostItem.color}</span></>}
                {lostItem?.brand && <><span className="admin-panel__key">Brand</span><span className="admin-panel__val">{lostItem.brand}</span></>}
                {lostItem?.model && <><span className="admin-panel__key">Model</span><span className="admin-panel__val">{lostItem.model}</span></>}
                <span className="admin-panel__key">Location</span>
                <span className="admin-panel__val">{lostItem?.location}</span>
                <span className="admin-panel__key">Status</span>
                <span className="admin-panel__val"><StatusBadge status={lostItem?.status} /></span>
              </div>
              {/* Private Verification Info */}
              {(lostItem?.uniqueMarks || lostItem?.ownershipDetails) && (
                <div className="admin-panel__private">
                  <div className="admin-panel__private-title">🔒 Verification Details</div>
                  {lostItem.uniqueMarks && (
                    <p><strong>Unique Marks:</strong> {lostItem.uniqueMarks}</p>
                  )}
                  {lostItem.ownershipDetails && (
                    <p><strong>Ownership Details:</strong> {lostItem.ownershipDetails}</p>
                  )}
                </div>
              )}
              {lostItem?.description && (
                <p className="admin-panel__description">{lostItem.description}</p>
              )}
            </div>

            {/* CENTER — Match Summary */}
            <div className="admin-panel admin-panel--center">
              <div className="admin-match-summary">
                <div className="admin-match-score">{score}%</div>
                <div className="admin-match-level">{matchLevel}</div>
              </div>

              <div className="admin-matched-fields">
                <div className="admin-matched-fields__title">Matched Fields</div>
                {matchedFields && matchedFields.length > 0 ? (
                  matchedFields.map((f) => (
                    <div key={f} className="admin-matched-field-row">
                      <span className="admin-matched-field-check">✅</span>
                      <span className="admin-matched-field-name">{f}</span>
                    </div>
                  ))
                ) : (
                  <p className="admin-muted" style={{ fontSize: '12px' }}>No strong field matches</p>
                )}
              </div>

              {/* Actions */}
              <div className="admin-match-actions">
                {status === 'Pending' && (
                  <>
                    <button className="btn btn--secondary admin-action-btn" onClick={() => onVerify(match._id)}>
                      ✅ Verify Match
                    </button>
                    <button className="btn btn--danger admin-action-btn" onClick={() => onReject(match._id)}>
                      ❌ Reject Match
                    </button>
                  </>
                )}
                {status === 'Verified' && (
                  <>
                    <div className="admin-verified-badge">✅ Match Verified</div>
                    <button className="btn btn--primary admin-action-btn" onClick={() => onMarkReturned(match._id)}>
                      📦 Mark as Returned
                    </button>
                    <button className="btn btn--danger admin-action-btn" onClick={() => onReject(match._id)}>
                      ❌ Reject Match
                    </button>
                  </>
                )}
                {status === 'Rejected' && (
                  <div className="admin-rejected-badge">❌ Match Rejected</div>
                )}
                {status === 'Returned' && (
                  <>
                    <div className="admin-returned-badge">📦 Item Returned</div>
                    <div className="admin-return-info">
                      <p><strong>Owner:</strong> {lostItem?.user?.name}</p>
                      <p><strong>Finder:</strong> {foundItem?.user?.name}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT — Found Item */}
            <div className="admin-panel">
              <div className="admin-panel__label admin-panel__label--found">📦 Found Report</div>
              {imageUrl(foundItem?.image) ? (
                <img src={imageUrl(foundItem.image)} alt="" className="admin-panel__image" />
              ) : (
                <div className="admin-panel__image-placeholder">No Image</div>
              )}
              <div className="admin-panel__info-grid">
                <span className="admin-panel__key">Finder</span>
                <span className="admin-panel__val">{foundItem?.user?.name}</span>
                <span className="admin-panel__key">Item Type</span>
                <span className="admin-panel__val">{foundItem?.itemType || '—'}</span>
                <span className="admin-panel__key">Category</span>
                <span className="admin-panel__val">{foundItem?.category}</span>
                {foundItem?.color && <><span className="admin-panel__key">Color</span><span className="admin-panel__val">{foundItem.color}</span></>}
                {foundItem?.brand && <><span className="admin-panel__key">Brand</span><span className="admin-panel__val">{foundItem.brand}</span></>}
                {foundItem?.model && <><span className="admin-panel__key">Model</span><span className="admin-panel__val">{foundItem.model}</span></>}
                <span className="admin-panel__key">Location</span>
                <span className="admin-panel__val">{foundItem?.location}</span>
                <span className="admin-panel__key">Status</span>
                <span className="admin-panel__val"><StatusBadge status={foundItem?.status} /></span>
              </div>
              {/* Private Finder Observations */}
              {(foundItem?.uniqueMarks || foundItem?.additionalObservations) && (
                <div className="admin-panel__private">
                  <div className="admin-panel__private-title">🔒 Finder Observations</div>
                  {foundItem.uniqueMarks && (
                    <p><strong>Unique Marks:</strong> {foundItem.uniqueMarks}</p>
                  )}
                  {foundItem.additionalObservations && (
                    <p><strong>Additional Notes:</strong> {foundItem.additionalObservations}</p>
                  )}
                </div>
              )}
              {foundItem?.description && (
                <p className="admin-panel__description">{foundItem.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MatchesTab = ({ matches, onVerify, onReject, onMarkReturned }) => {
  const [filter, setFilter] = useState('all');

  const filtered = matches.filter((m) => {
    if (filter === 'all') return true;
    return m.status.toLowerCase() === filter;
  });

  return (
    <div>
      <div className="admin-matches-filter">
        {['all', 'Pending', 'Verified', 'Rejected', 'Returned'].map((f) => (
          <button
            key={f}
            className={`admin-filter-btn ${filter === f ? 'admin-filter-btn--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f} ({f === 'all' ? matches.length : matches.filter((m) => m.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="dashboard__empty">No matches found for this filter.</p>
      ) : (
        <div className="admin-matches-list">
          {filtered.map((match) => (
            <MatchCard
              key={match._id}
              match={match}
              onVerify={onVerify}
              onReject={onReject}
              onMarkReturned={onMarkReturned}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Claims Review Tab
// ─────────────────────────────────────────────
const ClaimsTab = ({ claims, onVerify, onReject }) => {
  const [filter, setFilter] = useState('all');
  const filtered = claims.filter((c) => filter === 'all' || c.status === filter);

  return (
    <div>
      <div className="admin-matches-filter">
        {['all', 'pending', 'verified', 'rejected'].map((f) => (
          <button
            key={f}
            className={`admin-filter-btn ${filter === f ? 'admin-filter-btn--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} (
            {f === 'all' ? claims.length : claims.filter((c) => c.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="dashboard__empty">No claims found for this filter.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Claimant</th>
                <th>Found Item</th>
                <th>Their Lost Item</th>
                <th>Unique Marks</th>
                <th>Ownership Details</th>
                <th>Approx. Date Lost</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((claim) => (
                <tr key={claim._id}>
                  <td><strong>{claim.user?.name || 'Unknown'}</strong></td>
                  <td>
                    {claim.foundItem?.itemType || claim.foundItem?.category || '—'}
                    <br /><span className="admin-muted">{claim.foundItem?.location || ''}</span>
                  </td>
                  <td>
                    {claim.lostItem?.itemType || claim.lostItem?.category || '—'}
                    <br /><span className="admin-muted">{claim.lostItem?.location || ''}</span>
                  </td>
                  <td><span className="admin-private-field">{claim.uniqueMarks || '—'}</span></td>
                  <td><span className="admin-private-field">{claim.ownershipDetails || '—'}</span></td>
                  <td>
                    {claim.approximateDateLost
                      ? new Date(claim.approximateDateLost).toLocaleDateString()
                      : '—'}
                  </td>
                  <td><StatusBadge status={claim.status} /></td>
                  <td>
                    {claim.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn--secondary admin-action-btn" onClick={() => onVerify(claim._id)}>
                          ✅ Verify
                        </button>
                        <button className="btn btn--danger admin-action-btn" onClick={() => onReject(claim._id)}>
                          ❌ Reject
                        </button>
                      </div>
                    ) : (
                      <span className="admin-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main AdminDashboard Component
// ─────────────────────────────────────────────
const ADMIN_TABS = [
  { key: 'overview', label: 'Dashboard', path: '/admin' },
  { key: 'users', label: 'Users', path: '/admin/users' },
  { key: 'lost', label: 'Lost Reports', path: '/admin/lost' },
  { key: 'found', label: 'Found Reports', path: '/admin/found' },
  { key: 'matches', label: 'Matches', path: '/admin/matches' },
  { key: 'claims', label: 'Claims', path: '/admin/claims' },
];

const AdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [matches, setMatches] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/') return 'overview';
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/lost')) return 'lost';
    if (path.includes('/admin/found')) return 'found';
    if (path.includes('/admin/matches')) return 'matches';
    if (path.includes('/admin/claims')) return 'claims';
    if (path.includes('/admin/profile')) return 'profile';
    return 'overview';
  };

  const activeTab = getActiveTab();

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, lostRes, foundRes, matchesRes, claimsRes] = await Promise.all([
        getPlatformStats(),
        getAllUsersAdmin(),
        getAllLostItemsAdmin(),
        getAllFoundItemsAdmin(),
        getAllMatchesAdmin(),
        getAllClaimsAdmin(),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setLostItems(lostRes.data.lostItems);
      setFoundItems(foundRes.data.foundItems);
      setMatches(matchesRes.data.matches);
      setClaims(claimsRes.data.claims || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleDeleteLost = async (id) => {
    if (!window.confirm('Delete this lost item? This cannot be undone.')) return;
    try {
      await deleteLostItemAdmin(id);
      setLostItems((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleDeleteFound = async (id) => {
    if (!window.confirm('Delete this found item? This cannot be undone.')) return;
    try {
      await deleteFoundItemAdmin(id);
      setFoundItems((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleVerify = async (matchId) => {
    try {
      const result = await verifyMatchAdmin(matchId);
      setMatches((prev) => prev.map((m) => (m._id === matchId ? result.data.match : m)));
      // Refresh items so status badges update
      const [lostRes, foundRes] = await Promise.all([getAllLostItemsAdmin(), getAllFoundItemsAdmin()]);
      setLostItems(lostRes.data.lostItems);
      setFoundItems(foundRes.data.foundItems);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify match');
    }
  };

  const handleReject = async (matchId) => {
    if (!window.confirm('Reject this match? Both items will return to Pending.')) return;
    try {
      const result = await rejectMatchAdmin(matchId);
      setMatches((prev) => prev.map((m) => (m._id === matchId ? result.data.match : m)));
      const [lostRes, foundRes] = await Promise.all([getAllLostItemsAdmin(), getAllFoundItemsAdmin()]);
      setLostItems(lostRes.data.lostItems);
      setFoundItems(foundRes.data.foundItems);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject match');
    }
  };

  const handleMarkReturned = async (matchId) => {
    try {
      const result = await markMatchReturnedAdmin(matchId);
      setMatches((prev) => prev.map((m) => (m._id === matchId ? result.data.match : m)));
      const [lostRes, foundRes, statsRes] = await Promise.all([
        getAllLostItemsAdmin(),
        getAllFoundItemsAdmin(),
        getPlatformStats(),
      ]);
      setLostItems(lostRes.data.lostItems);
      setFoundItems(foundRes.data.foundItems);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark returned');
    }
  };

  const handleVerifyClaim = async (claimId) => {
    try {
      const result = await verifyClaimAdmin(claimId);
      setClaims((prev) => prev.map((c) => (c._id === claimId ? result.data.claim : c)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify claim');
    }
  };

  const handleRejectClaim = async (claimId) => {
    if (!window.confirm('Reject this claim?')) return;
    try {
      const result = await rejectClaimAdmin(claimId);
      setClaims((prev) => prev.map((c) => (c._id === claimId ? result.data.claim : c)));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject claim');
    }
  };

  const renderTabContent = () => {
    if (loading) return <Loader />;
    switch (activeTab) {
      case 'overview': return <Overview stats={stats} />;
      case 'users': return <UsersTab users={users} />;
      case 'lost': return <LostItemsTab items={lostItems} onDelete={handleDeleteLost} />;
      case 'found': return <FoundItemsTab items={foundItems} onDelete={handleDeleteFound} />;
      case 'matches':
        return (
          <MatchesTab
            matches={matches}
            onVerify={handleVerify}
            onReject={handleReject}
            onMarkReturned={handleMarkReturned}
          />
        );
      case 'claims':
        return (
          <ClaimsTab
            claims={claims}
            onVerify={handleVerifyClaim}
            onReject={handleRejectClaim}
          />
        );
      case 'profile':
        return (
          <div className="admin-profile-panel">
            <div className="admin-profile-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            <h2>{user?.name}</h2>
            <p className="admin-muted">{user?.email}</p>
            <span className="role-badge role-badge--admin">admin</span>
            <button className="btn btn--danger" style={{ marginTop: '24px' }} onClick={() => { logout(); navigate('/login'); }}>
              Logout
            </button>
          </div>
        );
      default: return <Overview stats={stats} />;
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="report-page__subtitle">Manage users, reports, and match verification</p>
        </div>
        <div className="admin-page__header-user">
          <span className="navbar__user">Hi, {user?.name}</span>
          <span className="role-badge role-badge--admin">admin</span>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Tab navigation */}
      <div className="admin-tabs">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`admin-tab ${activeTab === tab.key ? 'admin-tab--active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            {tab.label}
            {tab.key === 'matches' && matches.filter((m) => m.status === 'Pending').length > 0 && (
              <span className="admin-tab-badge">
                {matches.filter((m) => m.status === 'Pending').length}
              </span>
            )}
            {tab.key === 'claims' && claims.filter((c) => c.status === 'pending').length > 0 && (
              <span className="admin-tab-badge">
                {claims.filter((c) => c.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
        <button
          className={`admin-tab ${activeTab === 'profile' ? 'admin-tab--active' : ''}`}
          onClick={() => navigate('/admin/profile')}
        >
          Profile
        </button>
      </div>

      <div className="admin-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;
