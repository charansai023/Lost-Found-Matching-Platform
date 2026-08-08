import api from './api';

export const registerUser = async (name, email, password) => {
  const response = await api.post('/auth/register', { name, email, password });
  return response.data;
};

export const loginUser = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const getMyProfile = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const updateMyProfile = async (name) => {
  const response = await api.put('/auth/me', { name });
  return response.data;
};

export const completeProfile = async (fullName, email, mobileNumber) => {
  const response = await api.put('/auth/complete-profile', { fullName, email, mobileNumber });
  return response.data;
};

export const forgotPasswordSendOTP = async (email) => {
  const response = await api.post('/auth/forgot-password/send-otp', { email });
  return response.data;
};

export const verifyForgotPasswordOTP = async (email, otp) => {
  const response = await api.post('/auth/forgot-password/verify-otp', { email, otp });
  return response.data;
};

export const resetPasswordWithOTP = async (email, otp, newPassword) => {
  const response = await api.post('/auth/forgot-password/reset', { email, otp, newPassword });
  return response.data;
};
