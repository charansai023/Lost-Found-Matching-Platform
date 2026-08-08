import React, { useState, useEffect } from 'react';
import rewardService from '../../../services/rewardService';
import './Rewards.css';

const staticRewards = [
  { id: 1, name: 'Printing Credits', pointsCost: 100, icon: '\ud83d\udda8\ufe0f' },
  { id: 2, name: 'Canteen Coupon', pointsCost: 200, icon: '\ud83c\udf54' },
  { id: 3, name: 'Library Extension', pointsCost: 300, icon: '\ud83d\udcda' },
  { id: 4, name: 'Stationery Voucher', pointsCost: 400, icon: '\u2712\ufe0f' },
  { id: 5, name: 'Event Pass', pointsCost: 500, icon: '\ud83c\udf9f\ufe0f' },
  { id: 6, name: 'College Merchandise', pointsCost: 800, icon: '\ud83d\udc55' }
];

const RedeemRewards = () => {
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    const fetchPoints = async () => {
      try {
        const response = await rewardService.getMyRewards();
        setUserPoints(response.data.rewardPoints);
      } catch (err) {
        console.error('Error fetching points', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPoints();
  }, []);

  const handleRedeem = async (reward) => {
    if (userPoints < reward.pointsCost) {
      setMessage({ text: `You don't have enough points for ${reward.name}.`, type: 'error' });
      return;
    }

    if (!window.confirm(`Are you sure you want to request redemption for ${reward.name}? This will cost ${reward.pointsCost} points once approved.`)) {
      return;
    }

    setRedeeming(true);
    try {
      await rewardService.redeemReward({ rewardName: reward.name, pointsCost: reward.pointsCost });
      setMessage({ text: `Successfully requested ${reward.name}. Waiting for admin approval.`, type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to submit request.', type: 'error' });
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) return <div className="page-transition">Loading...</div>;

  return (
    <div className="page-transition rewards-container">
      <div className="rewards-header">
        <h1 className="rewards-title">Redeem Rewards</h1>
        <div className="points-badge">Your Points: <strong>{userPoints}</strong></div>
      </div>
      
      {message.text && (
        <div className={`auth-error ${message.type === 'success' ? 'auth-success' : ''}`} style={message.type === 'success' ? { backgroundColor: '#dcfce7', color: '#166534' } : {}}>
          {message.text}
        </div>
      )}

      <div className="rewards-grid">
        {staticRewards.map((reward) => (
          <div key={reward.id} className="reward-item-card">
            <div className="reward-icon">{reward.icon}</div>
            <h3 className="reward-name">{reward.name}</h3>
            <p className="reward-cost">{reward.pointsCost} Points</p>
            <button 
              className="btn btn--primary" 
              onClick={() => handleRedeem(reward)}
              disabled={redeeming || userPoints < reward.pointsCost}
              style={{ width: '100%', marginTop: '16px' }}
            >
              {userPoints < reward.pointsCost ? 'Not enough points' : 'Redeem'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RedeemRewards;
