import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import rewardService from '../../../services/rewardService';
import './Rewards.css';

const RewardsDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const response = await rewardService.getMyRewards();
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch rewards');
      } finally {
        setLoading(false);
      }
    };
    fetchRewards();
  }, []);

  if (loading) return <div className="page-transition">Loading...</div>;
  if (error) return <div className="auth-error">{error}</div>;

  const { rewardPoints, itemsReturned, rewardLevel, rank, pointsToNextLevel, nextLevelName, history } = data;

  // Progress Bar logic
  const maxPointsForLevel = pointsToNextLevel ? (rewardPoints + pointsToNextLevel) : rewardPoints;
  const progressPercent = nextLevelName ? (rewardPoints / maxPointsForLevel) * 100 : 100;

  const getBadgeClass = (level) => {
    switch (level) {
      case 'Bronze Helper': return 'badge--bronze';
      case 'Silver Helper': return 'badge--silver';
      case 'Gold Helper': return 'badge--gold';
      case 'Platinum Helper': return 'badge--platinum';
      case 'Campus Legend': return 'badge--legend';
      default: return 'badge--bronze';
    }
  };

  return (
    <div className="page-transition rewards-container">
      <div className="rewards-header">
        <h1 className="rewards-title">Campus Rewards</h1>
        <div className="rewards-actions">
          <Link to="/student/rewards/redeem" className="btn btn--primary">Redeem Rewards</Link>
          <Link to="/student/rewards/leaderboard" className="btn btn--secondary" style={{ marginLeft: '10px' }}>Leaderboard</Link>
        </div>
      </div>

      <div className="rewards-stats-grid">
        <div className="rewards-stat-card gradient-primary">
          <h3>Total Points</h3>
          <div className="stat-value">{rewardPoints}</div>
        </div>
        <div className="rewards-stat-card gradient-secondary">
          <h3>Items Returned</h3>
          <div className="stat-value">{itemsReturned}</div>
        </div>
        <div className="rewards-stat-card gradient-tertiary">
          <h3>Current Rank</h3>
          <div className="stat-value">#{rank}</div>
        </div>
        <div className="rewards-stat-card">
          <h3>Reward Level</h3>
          <div className={`stat-value badge ${getBadgeClass(rewardLevel)}`}>{rewardLevel}</div>
        </div>
      </div>

      <div className="rewards-progress-card">
        <h3>Level Progress</h3>
        {nextLevelName ? (
          <>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <p className="progress-text">
              <strong>{pointsToNextLevel}</strong> more points to reach <span className={`badge ${getBadgeClass(nextLevelName)}`}>{nextLevelName}</span>!
            </p>
          </>
        ) : (
          <p className="progress-text">You have reached the maximum level! You are a Campus Legend!</p>
        )}
      </div>

      <div className="rewards-history-section">
        <h3>Recent Reward History</h3>
        {history && history.length > 0 ? (
          <table className="rewards-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Points</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item._id}>
                  <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`history-type type-${item.type}`}>{item.type.toUpperCase()}</span>
                  </td>
                  <td className={item.type === 'earned' ? 'text-green' : 'text-red'}>
                    {item.type === 'earned' ? '+' : '-'}{item.points}
                  </td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="dashboard__empty">No reward history found. Start returning lost items to earn points!</p>
        )}
      </div>
    </div>
  );
};

export default RewardsDashboard;
