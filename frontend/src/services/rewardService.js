import api from './api';

const getMyRewards = async () => {
  const response = await api.get('/rewards/my-rewards');
  return response.data;
};

const getLeaderboard = async () => {
  const response = await api.get('/rewards/leaderboard');
  return response.data;
};

const redeemReward = async (rewardData) => {
  const response = await api.post('/rewards/redeem', rewardData);
  return response.data;
};

const getRedemptionRequests = async () => {
  const response = await api.get('/admin/rewards/requests');
  return response.data;
};

const updateRedemptionRequest = async (id, action) => {
  const response = await api.put(`/admin/rewards/request/${id}/${action}`);
  return response.data;
};

const getRewardConfig = async () => {
  const response = await api.get('/admin/rewards/config');
  return response.data;
};

const updateRewardConfig = async (pointValues) => {
  const response = await api.put('/admin/rewards/config', { pointValues });
  return response.data;
};

export default {
  getMyRewards,
  getLeaderboard,
  redeemReward,
  getRedemptionRequests,
  updateRedemptionRequest,
  getRewardConfig,
  updateRewardConfig,
};
