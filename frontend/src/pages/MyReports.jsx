import { useEffect, useState } from 'react';
import { getMyLostItems, getMyFoundItems, getMyMatches } from '../services/myService';
import { getMyClaims } from '../services/claimService';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import './MyReports.css';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace('/api', '');
const imageUrl = (path) => (path ? `${API_ORIGIN}${path}` : null);

const MATCH_LEVEL_COLOR = {
  'High Match': { bg: '#dcfce7', color: '#15803d' },
  'Possible Match': { bg: '#fef3c7', color: '#d97706' },
  'Low Match': { bg: '#f3f4f6', color: '#6b7280' },
};

const MyReports = () => {
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [matches, setMatches] = useState([]);
  const [claims, setClaims] = useState([]);
  const [activeTab, setActiveTab] = useState('lost');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemType, setSelectedItemType] = useState('lost');

  useEffect(() => {
    const loadReports = async () => {
      try {
        const [lostResult, foundResult, matchResult, claimResult] = await Promise.all([
          getMyLostItems(),
          getMyFoundItems(),
          getMyMatches(),
          getMyClaims(),
        ]);
        setLostItems(lostResult.data.lostItems);
        setFoundItems(foundResult.data.foundItems);
        setMatches(matchResult.data.matches);
        setClaims(claimResult.data.claims || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load your reports');
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, []);

  // Find matches related to a specific item
  const getMatchesForItem = (item, type) => {
    return matches.filter((m) => {
      if (type === 'lost') return m.lostItem?._id === item._id || m.lostItem?._id?.toString() === item._id?.toString();
      return m.foundItem?._id === item._id || m.foundItem?._id?.toString() === item._id?.toString();
    });
  };

  const openDetail = (item, type) => {
    setSelectedItem(item);
    setSelectedItemType(type);
  };

  const closeDetail = () => setSelectedItem(null);

  if (loading) return <Loader />;

  const itemsToShow = activeTab === 'lost' ? lostItems : foundItems;

  return (
    <div className="my-reports-page">
      <h1>My Reports</h1>
      <p className="report-page__subtitle">Track the status of all your lost and found item reports</p>

      {error && <div className="auth-error">{error}</div>}

      <div className="reports-tabs">
        <button
          className={`reports-tab ${activeTab === 'lost' ? 'reports-tab--active' : ''}`}
          onClick={() => setActiveTab('lost')}
        >
          My Lost Reports ({lostItems.length})
        </button>
        <button
          className={`reports-tab ${activeTab === 'found' ? 'reports-tab--active' : ''}`}
          onClick={() => setActiveTab('found')}
        >
          My Found Reports ({foundItems.length})
        </button>
        <button
          className={`reports-tab ${activeTab === 'claims' ? 'reports-tab--active' : ''}`}
          onClick={() => setActiveTab('claims')}
        >
          My Claims ({claims.length})
        </button>
      </div>

      <div className="reports-content">
        {activeTab === 'claims' && (
          claims.length === 0 ? (
            <div className="my-reports-empty">
              <span className="my-reports-empty__icon">📬</span>
              <p>You have not submitted any ownership claims yet.</p>
            </div>
          ) : (
            <div className="my-reports-grid">
              {claims.map((claim) => (
                <div key={claim._id} className="my-report-card">
                  <div className="my-report-card__body">
                    <div style={{ marginBottom: 10 }}>
                      <StatusBadge status={claim.status} />
                    </div>
                    <h3 className="my-report-card__title">
                      {claim.foundItem?.itemType || claim.foundItem?.category || 'Found Item'}
                    </h3>
                    <p className="my-report-card__meta">
                      <strong>Found At:</strong> {claim.foundItem?.location || '—'}
                    </p>
                    {claim.lostItem && (
                      <p className="my-report-card__meta">
                        <strong>Your Lost Item:</strong>{' '}
                        {claim.lostItem.itemType || claim.lostItem.category}
                      </p>
                    )}
                    <p className="my-report-card__meta">
                      <strong>Date Submitted:</strong>{' '}
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </p>
                    <p className="my-report-card__meta">
                      <strong>Approx. Date Lost:</strong>{' '}
                      {new Date(claim.approximateDateLost).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab !== 'claims' && (
          itemsToShow.length === 0 ? (
            <div className="my-reports-empty">
              <span className="my-reports-empty__icon">{activeTab === 'lost' ? '🔍' : '📦'}</span>
              <p>
                {activeTab === 'lost'
                  ? 'You have not reported any lost items yet.'
                  : 'You have not reported any found items yet.'}
              </p>
            </div>
          ) : (
            <div className="my-reports-grid">
              {itemsToShow.map((item) => {
                const itemMatches = getMatchesForItem(item, activeTab);
                const bestMatch = itemMatches[0];
                return (
                  <div key={item._id} className="my-report-card">
                    {/* Image */}
                    <div className="my-report-card__image-wrapper">
                      {imageUrl(item.image) ? (
                        <img src={imageUrl(item.image)} alt={item.itemType} className="my-report-card__image" />
                      ) : (
                        <div className="my-report-card__image-placeholder">No Image</div>
                      )}
                      <div className="my-report-card__status-overlay">
                        <StatusBadge status={item.status} />
                      </div>
                    </div>

                    {/* Body */}
                    <div className="my-report-card__body">
                      <h3 className="my-report-card__title">{item.itemType || item.category}</h3>
                      <p className="my-report-card__meta">
                        <strong>Category:</strong> {item.category}
                      </p>
                      {item.color && (
                        <p className="my-report-card__meta">
                          <strong>Color:</strong> {item.color}
                        </p>
                      )}
                      <p className="my-report-card__meta">
                        <strong>Location:</strong> {item.location}
                      </p>
                      <p className="my-report-card__meta">
                        <strong>{activeTab === 'lost' ? 'Date Lost' : 'Date Found'}:</strong>{' '}
                        {new Date(activeTab === 'lost' ? item.dateLost : item.dateFound).toLocaleDateString()}
                      </p>

                      {/* Best match preview */}
                      {bestMatch && (
                        <div className="my-report-card__match-preview">
                          <span
                            className="my-report-card__match-badge"
                            style={{
                              backgroundColor: (MATCH_LEVEL_COLOR[bestMatch.matchLevel] || {}).bg || '#f3f4f6',
                              color: (MATCH_LEVEL_COLOR[bestMatch.matchLevel] || {}).color || '#6b7280',
                            }}
                          >
                            {bestMatch.score}% · {bestMatch.matchLevel}
                          </span>
                          <span className="my-report-card__match-status">
                            Match: <StatusBadge status={bestMatch.status} />
                          </span>
                        </div>
                      )}

                      <button
                        className="btn btn--secondary my-report-card__view-btn"
                        onClick={() => openDetail(item, activeTab)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selectedItem && (
        <div className="detail-modal-overlay" onClick={closeDetail}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="detail-modal__close" onClick={closeDetail}>✕</button>

            <div className="detail-modal__header">
              <div>
                <h2>{selectedItem.itemType || selectedItem.category}</h2>
                <StatusBadge status={selectedItem.status} size="md" />
              </div>
              {imageUrl(selectedItem.image) && (
                <img
                  src={imageUrl(selectedItem.image)}
                  alt={selectedItem.itemType}
                  className="detail-modal__image"
                />
              )}
            </div>

            <div className="detail-modal__body">
              {/* Public Info */}
              <div className="detail-modal__section">
                <h4 className="detail-modal__section-title">📋 Item Details</h4>
                <div className="detail-modal__grid">
                  <div><strong>Item Type</strong><span>{selectedItem.itemType}</span></div>
                  <div><strong>Category</strong><span>{selectedItem.category}</span></div>
                  {selectedItem.brand && <div><strong>Brand</strong><span>{selectedItem.brand}</span></div>}
                  {selectedItem.color && <div><strong>Color</strong><span>{selectedItem.color}</span></div>}
                  {selectedItem.model && <div><strong>Model</strong><span>{selectedItem.model}</span></div>}
                  <div><strong>Location</strong><span>{selectedItem.location}</span></div>
                  <div>
                    <strong>{selectedItemType === 'lost' ? 'Date Lost' : 'Date Found'}</strong>
                    <span>
                      {new Date(
                        selectedItemType === 'lost' ? selectedItem.dateLost : selectedItem.dateFound
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {selectedItem.description && (
                  <p className="detail-modal__description">{selectedItem.description}</p>
                )}
              </div>

              {/* Private Info */}
              {(selectedItem.uniqueMarks || selectedItem.ownershipDetails || selectedItem.additionalObservations) && (
                <div className="detail-modal__section detail-modal__section--private">
                  <h4 className="detail-modal__section-title">🔒 Private Verification Details</h4>
                  {selectedItem.uniqueMarks && (
                    <div className="detail-modal__private-row">
                      <strong>Unique Marks:</strong>
                      <span>{selectedItem.uniqueMarks}</span>
                    </div>
                  )}
                  {selectedItem.ownershipDetails && (
                    <div className="detail-modal__private-row">
                      <strong>Ownership Details:</strong>
                      <span>{selectedItem.ownershipDetails}</span>
                    </div>
                  )}
                  {selectedItem.additionalObservations && (
                    <div className="detail-modal__private-row">
                      <strong>Additional Observations:</strong>
                      <span>{selectedItem.additionalObservations}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Match Info */}
              {(() => {
                const itemMatches = getMatchesForItem(selectedItem, selectedItemType);
                if (itemMatches.length === 0) return null;
                return (
                  <div className="detail-modal__section">
                    <h4 className="detail-modal__section-title">🔗 Match Information</h4>
                    {itemMatches.map((match) => {
                      const counterpart =
                        selectedItemType === 'lost' ? match.foundItem : match.lostItem;
                      return (
                        <div key={match._id} className="detail-modal__match-card">
                          <div className="detail-modal__match-header">
                            <span
                              className="detail-modal__match-score"
                              style={{
                                backgroundColor: (MATCH_LEVEL_COLOR[match.matchLevel] || {}).bg || '#f3f4f6',
                                color: (MATCH_LEVEL_COLOR[match.matchLevel] || {}).color || '#6b7280',
                              }}
                            >
                              {match.score}% · {match.matchLevel}
                            </span>
                            <StatusBadge status={match.status} />
                          </div>

                          {counterpart && (
                            <div className="detail-modal__match-counterpart">
                              <p>
                                <strong>{selectedItemType === 'lost' ? 'Found By' : 'Reported By'}:</strong>{' '}
                                {counterpart.user?.name || 'Unknown'}
                              </p>
                              <p>
                                <strong>{selectedItemType === 'lost' ? 'Found' : 'Lost'} Item:</strong>{' '}
                                {counterpart.itemType || counterpart.category}
                              </p>
                              <p>
                                <strong>Location:</strong> {counterpart.location}
                              </p>
                            </div>
                          )}

                          {match.matchedFields && match.matchedFields.length > 0 && (
                            <div className="detail-modal__matched-fields">
                              <strong>Matched on:</strong>
                              <div className="detail-modal__fields-list">
                                {match.matchedFields.map((f) => (
                                  <span key={f} className="detail-modal__field-tag">
                                    ✅ {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyReports;
