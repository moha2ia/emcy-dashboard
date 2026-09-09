import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('emcy_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (expired/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('emcy_token');
      localStorage.removeItem('emcy_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const getMe = () => api.get('/auth/me');
export const registerUser = (data) => api.post('/auth/register', data);

// Users
export const getUsers = () => api.get('/users');
export const getRanking = () => api.get('/users/ranking');
export const getUser = (id) => api.get(`/users/${id}`);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const uploadAvatar = (formData) => api.post('/users/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// Progress
export const getProgress = (params) => api.get('/progress', { params });
export const getStats = () => api.get('/progress/stats');
export const getTracker = () => api.get('/progress/tracker');
export const toggleProgress = (userId, weekNumber) => api.put(`/progress/toggle/${userId}/${weekNumber}`);
export const createProgress = (data) => api.post('/progress', data);
export const updateProgress = (id, data) => api.put(`/progress/${id}`, data);

// Logs (Calendar)
export const getLogs = (params) => api.get('/logs', { params });
export const createLog = (data) => api.post('/logs', data);
export const uploadWorkFile = (formData) => api.post('/logs/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getRecentActivity = () => api.get('/logs/recent');

// Tasks
export const getTasks = () => api.get('/tasks');
export const createTask = (data) => api.post('/tasks', data);
export const completeTask = (id, data) => api.put(`/tasks/${id}/complete`, data);
export const reopenTask = (id) => api.put(`/tasks/${id}/reopen`);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const uploadTaskFile = (formData) => api.post('/tasks/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

export default api;
