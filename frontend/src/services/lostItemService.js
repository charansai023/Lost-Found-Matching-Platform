import api from './api';

// Creates a new lost item report. `formData` should be a FormData instance
// since it may contain an image file.
export const createLostItem = async (formData) => {
  const response = await api.post('/lost', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// Fetches lost items with optional search/filter/pagination query params
export const getLostItems = async (params = {}) => {
  const response = await api.get('/lost', { params });
  return response.data;
};

export const getLostItemById = async (id) => {
  const response = await api.get(`/lost/${id}`);
  return response.data;
};

export const updateLostItem = async (id, formData) => {
  const response = await api.put(`/lost/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deleteLostItem = async (id) => {
  const response = await api.delete(`/lost/${id}`);
  return response.data;
};
