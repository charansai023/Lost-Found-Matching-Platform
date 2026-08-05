import api from './api';

// Creates a claim for a found item
export const createClaim = async (formData) => {
  const response = await api.post('/claims', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// Get the logged-in user's own claim requests
export const getMyClaims = async () => {
  const response = await api.get('/claims/my-claims');
  return response.data;
};
