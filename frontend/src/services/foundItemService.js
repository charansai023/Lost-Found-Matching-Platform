import api from './api';

// Creates a new found item report. `formData` should be a FormData instance
// since it may contain an image file. The backend automatically calculates
// matches against existing lost items and returns them in the response.
export const createFoundItem = async (formData) => {
  const response = await api.post('/found', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getFoundItems = async (params = {}) => {
  const response = await api.get('/found', { params });
  return response.data;
};

export const getFoundItemById = async (id) => {
  const response = await api.get(`/found/${id}`);
  return response.data;
};

export const updateFoundItem = async (id, formData) => {
  const response = await api.put(`/found/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deleteFoundItem = async (id) => {
  const response = await api.delete(`/found/${id}`);
  return response.data;
};
