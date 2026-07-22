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

        // Count how many high matches exist across all found items
        let highMatchCount = 0;
        matchResult.data.results.forEach((entry) => {
          highMatchCount += entry.matches.filter((m) => m.status === 'High Match').length;
        });

        setStats({
          totalLost: lostResult.data.pagination.total,
          totalFound: foundResult.data.pagination.total,
          highMatches: highMatchCount,
        });

        setRecentLost(lostResult.data.lostItems);
        setRecentFound(foundResult.data.foundItems);
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
      <h1>Dashboard</h1>
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
          <span className="stat-card__label">High Matches</span>
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
                  <span className="dashboard__list-title">{item.itemName}</span>
                  <span className="dashboard__list-meta">{item.location}</span>
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
                  <span className="dashboard__list-title">{item.itemName}</span>
                  <span className="dashboard__list-meta">{item.location}</span>
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
