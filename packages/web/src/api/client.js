import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('medrem_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('medrem_token');
      localStorage.removeItem('medrem_user');
      window.location.href = '/onboarding';
    }
    return Promise.reject(error);
  }
);

// Auth
export const sendOTP = (phone) => api.post('/auth/send-otp', { phone });
export const verifyOTP = (phone, otp) => api.post('/auth/verify-otp', { phone, otp });

// Users
export const getMe = () => api.get('/users/me');
export const updateMe = (data) => api.put('/users/me', data);
export const uploadFacePhoto = (formData) =>
  api.post('/users/face-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Prescriptions
export const uploadPrescription = (formData) =>
  api.post('/prescriptions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
export const getPrescriptions = () => api.get('/prescriptions');
export const confirmPrescription = (id, medicines) =>
  api.post(`/prescriptions/${id}/confirm`, { medicines });
export const deletePrescription = (id) => api.delete(`/prescriptions/${id}`);

// Medicines
export const getMedicines = () => api.get('/medicines');
export const createMedicine = (data) => api.post('/medicines', data);
export const updateMedicine = (id, data) => api.put(`/medicines/${id}`, data);
export const deleteMedicine = (id) => api.delete(`/medicines/${id}`);

// Schedule
export const getTodaySchedule = () => api.get('/schedule/today');
export const getDateSchedule = (date) => api.get(`/schedule/date/${date}`);

// Doses
export const submitDosePhoto = (doseId, formData) =>
  api.post(`/doses/${doseId}/submit-photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
export const partialOverride = (doseId, reason) =>
  api.post(`/doses/${doseId}/partial-override`, { reason });

// Adherence
export const getAdherenceHistory = () => api.get('/adherence/history');
export const getAdherenceStats = () => api.get('/adherence/stats');

// Push
export const subscribePush = (subscription) => api.post('/push/subscribe', { subscription });
export const sendTestPush = () => api.post('/push/test');
export const getVapidKey = () => api.get('/push/vapid-key');

export default api;
