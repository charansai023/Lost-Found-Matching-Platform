import api from './api';

// Fetches match results for every found item against all lost items
export const getAllMatches = async () => {
  const response = await api.get('/matches');
  return response.data;
};

// Fetches match results for one specific found item
export const getMatchesForFoundItem = async (foundItemId) => {
  const response = await api.get(`/matches/${foundItemId}`);
  return response.data;
};

// Fetches background AI image matching status for a report
export const getMatchingStatus = async (itemType, itemId) => {
  const response = await api.get(`/matches/status/${itemType}/${itemId}`);
  return response.data;
};
