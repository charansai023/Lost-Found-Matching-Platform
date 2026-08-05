import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLostItems } from '../services/lostItemService';
import { getFoundItems } from '../services/foundItemService';
import { getAllMatches } from '../services/matchService';
import Loader from '../components/Loader';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalLost: 0,
    totalFound: 0,
    highMatches: 0,
    aiMatches: 0,
  });
  const [recentLost, setRecentLost] = useState([]);
  const [recentFound, setRecentFound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [lostResult, foundResult, matchResult] = await Promise.all([
          getLostItems({ page: 1, limit: 5 }),
          getFoundItems({ page: 1, limit: 5 }),
          getAllMatches(),
        ]);

        let highMatchCount = 0;
        let aiMatchCount = 0;

        const allMatches = matchResult.data?.matches || [];
        if (allMatches.length > 0) {
          highMatchCount = allMatches.filter((m) => m.matchLevel === 'High Match' || m.score >= 70).length;
          aiMatchCount = allMatches.filter((m) => m.isAiMatch || (m.imageSimilarityScore && m.imageSimilarityScore >= 80)).length;
        } else if (matchResult.data?.results) {
          matchResult.data.results.forEach((entry) => {
            if (entry.matches) {
              entry.matches.forEach((m) => {
                if (m.matchLevel === 'High Match' || m.score >= 70) highMatchCount++;
                if (m.isAiMatch || (m.imageSimilarityScore && m.imageSimilarityScore >= 80)) aiMatchCount++;
              });
            }
          });
        }

        setStats({
          totalLost: lostResult.data?.pagination?.total || 0,
          totalFound: foundResult.data?.pagination?.total || 0,
          highMatches: highMatchCount,
          aiMatches: aiMatchCount,
        });

        setRecentLost(lostResult.data?.lostItems || []);
        setRecentFound(foundResult.data?.foundItems || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="dashboard">
      <h1>User Dashboard</h1>
      {error && <div className="auth-error">{error}</div>}

      <div className="dashboard__stats">
        <div className="stat-card">
          <span className="stat-card__value">{stats.totalLost}</span>
          <span className="stat-card__label">Total Lost Items</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{stats.totalFound}</span>
          <span className="stat-card__label">Total Found Items</span>
        </div>
        <div className="stat-card stat-card--highlight">
          <span className="stat-card__value">{stats.highMatches}</span>
          <span className="stat-card__label">High Confidence Matches</span>
        </div>
        <div className="stat-card stat-card--ai" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff' }}>
          <span className="stat-card__value" style={{ color: '#fff' }}>{stats.aiMatches}</span>
          <span className="stat-card__label" style={{ color: '#e0e7ff' }}>✨ AI Image Matches (&ge;80%)</span>
        </div>
      </div>

      <div className="dashboard__quick-links">
        <Link to="/lost-items/new" className="btn btn--primary">
          + Report Lost Item
        </Link>
        <Link to="/found-items/new" className="btn btn--primary">
          + Report Found Item
        </Link>
        <Link to="/matches" className="btn btn--secondary">
          View Matches
        </Link>
      </div>

      <div className="dashboard__recent">
        <div className="dashboard__recent-column">
          <h2>Recent Lost Reports</h2>
          {recentLost.length === 0 ? (
            <p className="dashboard__empty">No lost items reported yet.</p>
          ) : (
            <ul className="dashboard__list">
              {recentLost.map((item) => (
                <li key={item._id}>
                  <span className="dashboard__list-title">{item.itemType || item.category}</span>
                  <span className="dashboard__list-meta">{item.location} &middot; {item.matchingStatus === 'processing' ? '⏳ AI Matching...' : 'Ready'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard__recent-column">
          <h2>Recent Found Reports</h2>
          {recentFound.length === 0 ? (
            <p className="dashboard__empty">No found items reported yet.</p>
          ) : (
            <ul className="dashboard__list">
              {recentFound.map((item) => (
                <li key={item._id}>
                  <span className="dashboard__list-title">{item.itemType || item.category}</span>
                  <span className="dashboard__list-meta">{item.location} &middot; {item.matchingStatus === 'processing' ? '⏳ AI Matching...' : 'Ready'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
