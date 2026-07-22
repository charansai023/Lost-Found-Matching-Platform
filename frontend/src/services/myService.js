import api from './api';

export const getMyLostItems = async () => {
  const response = await api.get('/my/lost');
  return response.data;
};

export const getMyFoundItems = async () => {
  const response = await api.get('/my/found');
  return response.data;
};

export const getMyMatches = async () => {
  const response = await api.get('/my/matches');
  return response.data;
};
