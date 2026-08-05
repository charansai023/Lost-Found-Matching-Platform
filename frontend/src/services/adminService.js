import api from './api';

export const getPlatformStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data;
};

export const getAllUsersAdmin = async () => {
  const response = await api.get('/admin/users');
  return response.data;
};

export const getAllLostItemsAdmin = async () => {
  const response = await api.get('/admin/lost');
  return response.data;
};

export const getAllFoundItemsAdmin = async () => {
  const response = await api.get('/admin/found');
  return response.data;
};

export const getAllMatchesAdmin = async () => {
  const response = await api.get('/admin/matches');
  return response.data;
};

export const getMatchDetailAdmin = async (matchId) => {
  const response = await api.get(`/admin/match/${matchId}`);
  return response.data;
};

export const verifyMatchAdmin = async (matchId) => {
  const response = await api.put(`/admin/match/${matchId}/verify`);
  return response.data;
};

export const rejectMatchAdmin = async (matchId) => {
  const response = await api.put(`/admin/match/${matchId}/reject`);
  return response.data;
};

export const markMatchReturnedAdmin = async (matchId) => {
  const response = await api.put(`/admin/match/${matchId}/returned`);
  return response.data;
};

export const deleteLostItemAdmin = async (id) => {
  const response = await api.delete(`/admin/lost/${id}`);
  return response.data;
};

export const deleteFoundItemAdmin = async (id) => {
  const response = await api.delete(`/admin/found/${id}`);
  return response.data;
};

export const getAllClaimsAdmin = async () => {
  const response = await api.get('/admin/claims');
  return response.data;
};

export const verifyClaimAdmin = async (id) => {
  const response = await api.put(`/admin/claim/${id}/verify`);
  return response.data;
};

export const rejectClaimAdmin = async (id) => {
  const response = await api.put(`/admin/claim/${id}/reject`);
  return response.data;
};
