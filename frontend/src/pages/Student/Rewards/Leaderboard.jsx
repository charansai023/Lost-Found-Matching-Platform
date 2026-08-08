import React, { useState, useEffect } from 'react';
import rewardService from '../../../services/rewardService';
import './Rewards.css';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await rewardService.getLeaderboard();
        setLeaderboard(response.data.leaderboard);
      } catch (err) {
        console.error('Error fetching leaderboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

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

  if (loading) return <div className="page-transition">Loading...</div>;

  return (
    <div className="page-transition rewards-container">
      <h1 className="rewards-title">Top 10 Campus Heroes</h1>
      <p className="rewards-subtitle">Recognizing the most honest and helpful students on campus.</p>

      <div className="leaderboard-card">
        {leaderboard.length > 0 ? (
          <table className="rewards-table leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Level</th>
                <th>Points</th>
                <th>Items Returned</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((user, index) => (
                <tr key={user._id} className={index < 3 ? `rank-${index + 1}` : ''}>
                  <td>
                    {index === 0 && '\ud83e\udd47 '}
                    {index === 1 && '\ud83e\udd48 '}
                    {index === 2 && '\ud83e\udd49 '}
                    #{index + 1}
                  </td>
                  <td className="fw-bold">{user.name}</td>
                  <td>
                    <span className={`badge ${getBadgeClass(user.rewardLevel)}`}>{user.rewardLevel}</span>
                  </td>
                  <td className="points-col">{user.rewardPoints}</td>
                  <td>{user.itemsReturned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="dashboard__empty">No one is on the leaderboard yet. Be the first!</p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
