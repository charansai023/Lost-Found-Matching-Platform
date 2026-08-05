import api from './api';

// Registers a new user
export const registerUser = async (name, email, password) => {
  const response = await api.post('/auth/register', { name, email, password });
  return response.data;
};

// Logs in an existing user
export const loginUser = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

// Fetches the logged-in user's profile
export const getMyProfile = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

// Updates the logged-in user's own profile (currently just their name)
export const updateMyProfile = async (name) => {
  const response = await api.put('/auth/me', { name });
  return response.data;
};

// Completes the profile for the first-time sign-in
export const completeProfile = async (fullName, email, mobileNumber) => {
  const response = await api.put('/auth/complete-profile', { fullName, email, mobileNumber });
  return response.data;
};
