import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
import { fetchNotifications, markAsRead, markAllRead, deleteNotification } from '../services/notificationService';
import StatusBadge from '../components/StatusBadge';
import MatchBadge from '../components/MatchBadge';
import AiMatchAnalysis from '../components/AiMatchAnalysis';
import Loader from '../components/Loader';
import useAuth from '../hooks/useAuth';
import './AdminDashboard.css';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace('/api', '');
const imageUrl = (path) => (path ? `${API_ORIGIN}${path}` : null);

// ─────────────────────────────────────────────
// Sub-pages rendered inside the admin layout
// ─────────────────────────────────────────────

const Overview = ({ stats, matches, lostItems, foundItems, claims, onVerify, onReject, onMarkReturned, onVerifyClaim, onRejectClaim, onDeleteLost, onDeleteFound }) => {
  const navigate = useNavigate();
  if (!stats) return <Loader />;

  // Calculate AI stats from matches
  const aiMatchesList = matches.filter(m => m.isAiMatch || m.matchingMethod === 'Hybrid AI Engine');
  const imageMatches = aiMatchesList.filter(m => m.imageSimilarityScore > 0).length;
  const textMatches = aiMatchesList.filter(m => m.descriptionSimilarity > 0 || m.textScore > 0).length;
  const semanticMatches = aiMatchesList.filter(m => m.semanticSimilarity > 0 || m.overallTextSimilarity > 0).length;
  const avgConfidence = aiMatchesList.length > 0 
    ? Math.round(aiMatchesList.reduce((acc, m) => acc + (m.score || 0), 0) / aiMatchesList.length)
    : 0;

  const recoveryRate = stats.totalLost > 0 ? Math.round((stats.returnedMatches / stats.totalLost) * 100) : 0;
  const approvedClaims = stats.verifiedMatches || 0; // Approximation based on existing stats
  const totalClaims = stats.pendingMatches + stats.verifiedMatches;

  return (
    <div className="admin-overview-container">
      {/* 1. Summary Cards */}
      <div className="admin-stats-grid">
        <div className="stat-card">
          <span className="stat-card__icon">👥</span>
          <span className="stat-card__value">{stats.totalUsers}</span>
          <span className="stat-card__label">Total Users</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon">🔍</span>
          <span className="stat-card__value">{stats.totalLost}</span>
          <span className="stat-card__label">Lost Items</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon">📦</span>
          <span className="stat-card__value">{stats.totalFound}</span>
          <span className="stat-card__label">Found Items</span>
        </div>
        <div className="stat-card stat-card--highlight">
          <span className="stat-card__icon">⏳</span>
          <span className="stat-card__value">{stats.pendingMatches}</span>
          <span className="stat-card__label">Pending Claims</span>
        </div>
        <div className="stat-card stat-card--success">
          <span className="stat-card__icon">✅</span>
          <span className="stat-card__value">{stats.verifiedMatches}</span>
          <span className="stat-card__label">Approved Claims</span>
        </div>
        <div className="stat-card stat-card--danger">
          <span className="stat-card__icon">❌</span>
          <span className="stat-card__value">{stats.totalMatches - stats.verifiedMatches - stats.pendingMatches}</span>
          <span className="stat-card__label">Rejected Claims</span>
        </div>
        <div className="stat-card stat-card--info">
          <span className="stat-card__icon">📈</span>
          <span className="stat-card__value">{recoveryRate}%</span>
          <span className="stat-card__label">Recovered Items %</span>
        </div>
      </div>

      <div className="admin-overview-middle">
        {/* 2. Analytics Overview (Progress Bars) */}
        <div className="admin-analytics-section">
          <h3 className="section-title">Analytics Overview</h3>
          <div className="progress-wrapper">
            <div className="progress-header">
              <span>Lost vs Found Items</span>
              <span>{stats.totalFound} / {stats.totalLost}</span>
            </div>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill progress-bar-fill--blue" 
                style={{ width: `${stats.totalLost > 0 ? Math.min((stats.totalFound / stats.totalLost) * 100, 100) : 0}%` }}
              ></div>
            </div>
          </div>
          
          <div className="progress-wrapper">
            <div className="progress-header">
              <span>Approved Claims Rate</span>
              <span>{totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0}%</span>
            </div>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill progress-bar-fill--green" 
                style={{ width: `${totalClaims > 0 ? (approvedClaims / totalClaims) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          <div className="progress-wrapper">
            <div className="progress-header">
              <span>Recovery Rate</span>
              <span>{recoveryRate}%</span>
            </div>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill progress-bar-fill--gold" 
                style={{ width: `${recoveryRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* 5. AI Overview Card */}
        <div className="admin-ai-overview-card">
          <h3 className="section-title">🧠 AI Match Overview</h3>
          <div className="ai-stats-grid">
            <div className="ai-stat">
              <span className="ai-stat-val">{stats.aiMatches || aiMatchesList.length}</span>
              <span className="ai-stat-lbl">Total AI Matches</span>
            </div>
            <div className="ai-stat">
              <span className="ai-stat-val">{imageMatches}</span>
              <span className="ai-stat-lbl">Image Matches</span>
            </div>
            <div className="ai-stat">
              <span className="ai-stat-val">{textMatches}</span>
              <span className="ai-stat-lbl">Text Matches</span>
            </div>
            <div className="ai-stat">
              <span className="ai-stat-val">{semanticMatches}</span>
              <span className="ai-stat-lbl">Semantic Matches</span>
            </div>
            <div className="ai-stat ai-stat--full">
              <span className="ai-stat-val">{avgConfidence}%</span>
              <span className="ai-stat-lbl">Average Confidence Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quick Actions */}
      <div className="admin-quick-actions">
        <h3 className="section-title">Quick Actions</h3>
        <div className="quick-actions-grid">
          {/* Hiding buttons that don't have backend support as per user instruction 2 */}
          <button className="btn btn--secondary" onClick={() => navigate('/admin/claims')}>
            📋 View Pending Claims
          </button>
          <button className="btn btn--secondary" onClick={() => navigate('/admin/matches')}>
            ✨ View AI Matches
          </button>
        </div>
      </div>

      {/* 4. Recent Data */}
      <div className="admin-recent-sections">
        <h3 className="section-title">Recent AI Matches</h3>
        <div className="admin-matches-list">
          {matches.filter(m => m.isAiMatch || m.matchingMethod === 'Hybrid AI Engine').slice(0, 3).map(match => (
            <MatchCard key={match._id} match={match} onVerify={onVerify} onReject={onReject} onMarkReturned={onMarkReturned} />
          ))}
        </div>

        <h3 className="section-title" style={{ marginTop: 32 }}>Recent Claims</h3>
        <ClaimsTab claims={claims.slice(0, 3)} onVerify={onVerifyClaim} onReject={onRejectClaim} />

        <h3 className="section-title" style={{ marginTop: 32 }}>Recent Lost Items</h3>
        <LostItemsTab items={lostItems.slice(0, 3)} onDelete={onDeleteLost} />

        <h3 className="section-title" style={{ marginTop: 32 }}>Recent Found Items</h3>
        <FoundItemsTab items={foundItems.slice(0, 3)} onDelete={onDeleteFound} />
      </div>
    </div>
  );
};

const UsersTab = ({ users }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <input 
          type="text" 
          placeholder="Search users..." 
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', width: '250px' }}
        />
      </div>
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
            {paginated.map((u) => (
              <tr key={u._id}>
                <td><strong>{u.name}</strong></td>
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
            {paginated.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Showing page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', fontSize: '13px' }}>Previous</button>
            <button className="btn btn--secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', fontSize: '13px' }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

const LostItemsTab = ({ items, onDelete }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = items.filter(item => 
    (item.itemType || '').toLowerCase().includes(search.toLowerCase()) || 
    (item.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.location || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.user?.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <input 
          type="text" 
          placeholder="Search lost items..." 
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', width: '250px' }}
        />
      </div>
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
            {paginated.map((item) => (
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
            {paginated.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>No items found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Showing page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', fontSize: '13px' }}>Previous</button>
            <button className="btn btn--secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', fontSize: '13px' }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

const FoundItemsTab = ({ items, onDelete }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = items.filter(item => 
    (item.itemType || '').toLowerCase().includes(search.toLowerCase()) || 
    (item.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.location || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.user?.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <input 
          type="text" 
          placeholder="Search found items..." 
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', width: '250px' }}
        />
      </div>
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
            {paginated.map((item) => (
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
            {paginated.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>No items found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Showing page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', fontSize: '13px' }}>Previous</button>
            <button className="btn btn--secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', fontSize: '13px' }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

const MatchCard = ({ match, onVerify, onReject, onMarkReturned }) => {
  const [expanded, setExpanded] = useState(false);
  const { lostItem, foundItem, score, matchLevel, matchedFields, status, isAiMatch, imageSimilarityScore, aiConfidence } = match;

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
          <MatchBadge
            score={score}
            status={matchLevel}
            isAiMatch={isAiMatch}
            imageSimilarityScore={imageSimilarityScore}
            aiConfidence={aiConfidence}
          />
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
                <div className="admin-match-level">
                  {match.matchingMethod === 'Hybrid AI Engine' ? '✨ Hybrid AI Match' : (isAiMatch ? '✨ AI Match' : matchLevel)}
                </div>

                {match.matchingMethod === 'Hybrid AI Engine' ? (
                  <div className="admin-ai-match-analysis" style={{ marginTop: '12px', textAlign: 'left', background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', width: '100%', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>🧠 AI Match Analysis</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px', color: '#475569' }}>
                      <span>Image Similarity:</span><strong>{imageSimilarityScore}%</strong>
                      <span>Text Similarity:</span><strong>{match.overallTextSimilarity || match.semanticSimilarity}%</strong>
                      <span>Location Similarity:</span><strong>{match.locationSimilarity}%</strong>
                      <span style={{ borderTop: '1px solid #e2e8f0', paddingTop: '4px', marginTop: '4px' }}>Final Confidence:</span>
                      <strong style={{ borderTop: '1px solid #e2e8f0', paddingTop: '4px', marginTop: '4px', color: '#4f46e5' }}>{score}%</strong>
                    </div>

                    {match.explanation && (
                      <div style={{ marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontStyle: 'italic', color: '#334155', lineHeight: '1.3' }}>
                        💡 "{match.explanation}"
                      </div>
                    )}

                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem', color: '#0f766e', fontWeight: '500' }}>
                      {match.brandScore >= 70 && <span>✓ Same Brand</span>}
                      {(match.descriptionSimilarity >= 50 || match.textScore >= 50) && <span>✓ Similar Description</span>}
                      {match.locationSimilarity >= 70 && <span>✓ Same Location</span>}
                      {match.imageSimilarityScore >= 50 && <span>✓ Similar Images</span>}
                    </div>
                  </div>
                ) : (
                  imageSimilarityScore > 0 && (
                    <div style={{ fontSize: '12px', color: '#6366f1', marginTop: 4, fontWeight: 600 }}>
                      Image Similarity: {imageSimilarityScore}%
                    </div>
                  )
                )}
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

          {/* Professional AI Match Analysis Panel */}
          <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid #f1f5f9' }}>
            <AiMatchAnalysis match={match} />
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
                    {claim.lostItem ? (
                      <>
                        {claim.lostItem.itemType || claim.lostItem.category || '—'}
                        <br /><span className="admin-muted">{claim.lostItem.location || ''}</span>
                      </>
                    ) : (
                      <>
                        <strong>Direct Claim</strong>
                        <br /><span className="admin-muted">Not provided</span>
                      </>
                    )}
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
// Admin Notification Center
// ─────────────────────────────────────────────
const typeIcon = {
  match: '✨', claim_approved: '✅', claim_rejected: '❌', returned: '🎉',
  message: '📩', otp: '🔐', reminder: '⏰', new_lost: '📋', new_found: '📦',
  new_claim: '📎', high_confidence: '🧠', item_returned: '📬', info_submitted: '📝',
};

const formatTime = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const AdminNotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    fetchNotifications()
      .then((res) => setNotifications(res.data.data?.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleMarkRead = async (id) => {
    await markAsRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, readStatus: true } : n));
  };

  const handleMarkAll = async () => {
    await markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, readStatus: true })));
  };

  const handleDelete = async (id) => {
    await deleteNotification(id).catch(() => {});
    setNotifications((prev) => prev.filter((n) => n._id !== id));
  };

  const filtered = notifications.filter((n) => {
    if (unreadOnly && n.readStatus) return false;
    if (typeFilter !== 'all' && n.notificationType !== typeFilter) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) &&
        !n.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.readStatus).length;
  const notifTypes = [...new Set(notifications.map((n) => n.notificationType))];

  return (
    <div className="admin-notif-center">
      <div className="admin-notif-center__header">
        <div>
          <h2 className="admin-notif-center__title">🔔 Notification Center</h2>
          <p className="admin-muted">{unreadCount} unread of {notifications.length} total notifications</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn--secondary" style={{ fontSize: '0.8rem', padding: '6px 14px' }} onClick={handleMarkAll}>
            ✓ Mark All as Read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="admin-notif-center__filters">
        <input
          type="text"
          className="admin-notif-center__search"
          placeholder="🔍 Search notifications..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-notif-center__type-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {notifTypes.map((t) => (
            <option key={t} value={t}>{typeIcon[t] || '🔔'} {t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <label className="admin-notif-center__unread-toggle">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          &nbsp;Unread only
        </label>
      </div>

      {/* List */}
      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
          <span style={{ fontSize: '2.5rem' }}>🔕</span>
          <p style={{ marginTop: '12px', fontWeight: 500 }}>No notifications found</p>
        </div>
      ) : (
        <div className="admin-notif-center__list">
          {filtered.map((n) => (
            <div key={n._id} className={`admin-notif-row ${!n.readStatus ? 'admin-notif-row--unread' : ''}`}>
              <div className="admin-notif-row__icon">{typeIcon[n.notificationType] || '🔔'}</div>
              <div className="admin-notif-row__body">
                <div className="admin-notif-row__title">{n.title}</div>
                <div className="admin-notif-row__msg">{n.message}</div>
                <div className="admin-notif-row__meta">
                  <span>{formatTime(n.createdAt)}</span>
                  <span className={`admin-notif-priority admin-notif-priority--${n.priority}`}>{n.priority}</span>
                  {!n.readStatus && <span className="admin-notif-unread-dot" />}
                </div>
              </div>
              <div className="admin-notif-row__actions">
                {!n.readStatus && (
                  <button className="admin-notif-action-btn" onClick={() => handleMarkRead(n._id)} title="Mark as read">✓</button>
                )}
                <button className="admin-notif-action-btn admin-notif-action-btn--delete" onClick={() => handleDelete(n._id)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main AdminDashboard Component
// ─────────────────────────────────────────────
const ADMIN_TABS = [
  { key: 'overview', label: '📊 Dashboard', path: '/admin' },
  { key: 'users', label: '👥 Users', path: '/admin/users' },
  { key: 'lost', label: '📋 Lost Reports', path: '/admin/lost' },
  { key: 'found', label: '📦 Found Reports', path: '/admin/found' },
  { key: 'matches', label: '🔗 Matches', path: '/admin/matches' },
  { key: 'claims', label: '📎 Claims', path: '/admin/claims' },
  { key: 'notifications', label: '🔔 Notifications', path: '/admin/notifications' },
  { key: 'rewards_req', label: '🎁 Redemptions', path: '/admin/rewards/requests' },
  { key: 'rewards_set', label: '⚙️ Reward Settings', path: '/admin/rewards/settings' },
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
    if (path.includes('/admin/notifications')) return 'notifications';
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
      case 'overview': return <Overview stats={stats} matches={matches} lostItems={lostItems} foundItems={foundItems} claims={claims} onVerify={handleVerify} onReject={handleReject} onMarkReturned={handleMarkReturned} onVerifyClaim={handleVerifyClaim} onRejectClaim={handleRejectClaim} onDeleteLost={handleDeleteLost} onDeleteFound={handleDeleteFound} />;
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
      case 'notifications': return <AdminNotificationCenter />;
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
      default: return <Overview stats={stats} matches={matches} lostItems={lostItems} foundItems={foundItems} claims={claims} onVerify={handleVerify} onReject={handleReject} onMarkReturned={handleMarkReturned} onVerifyClaim={handleVerifyClaim} onRejectClaim={handleRejectClaim} onDeleteLost={handleDeleteLost} onDeleteFound={handleDeleteFound} />;
    }
  };

  return (
    <div className="dashboard page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#111827', margin: 0 }}>
          {ADMIN_TABS.find(t => t.key === activeTab)?.label || 'Dashboard'}
        </h1>
      </div>

      <div className="admin-main__content">
        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;
