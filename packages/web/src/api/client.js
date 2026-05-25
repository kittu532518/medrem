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
    const url = error.config?.url || '';
    // Only redirect to login on 401 from PROTECTED routes.
    // Auth routes (/auth/send-otp, /auth/verify-otp) return 401 for wrong OTP
    // — that must NOT trigger a redirect, just show an error message.
    const isAuthRoute = url.includes('/auth/');
    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('medrem_token');
      localStorage.removeItem('medrem_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const sendOTP    = (phone)      => api.post('/auth/send-otp',    { phone });
export const verifyOTP  = (phone, otp) => api.post('/auth/verify-otp',  { phone, otp });

// Users
export const getMe          = ()       => api.get('/users/me');
export const updateMe       = (data)   => api.put('/users/me', data);
export const uploadFacePhoto = (form)  =>
  api.post('/users/face-photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });

// Prescriptions
export const uploadPrescription = (form) =>
  api.post('/prescriptions/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
export const getPrescriptions   = ()         => api.get('/prescriptions');
export const confirmPrescription = (id, meds) => api.post(`/prescriptions/${id}/confirm`, { medicines: meds });
export const deletePrescription  = (id)       => api.delete(`/prescriptions/${id}`);

// Medicines
export const getMedicines    = ()        => api.get('/medicines');
export const createMedicine  = (data)    => api.post('/medicines', data);
export const updateMedicine  = (id, data)=> api.put(`/medicines/${id}`, data);
export const deleteMedicine  = (id)      => api.delete(`/medicines/${id}`);

// Schedule
export const getTodaySchedule  = ()     => api.get('/schedule/today');
export const getDateSchedule   = (date) => api.get(`/schedule/date/${date}`);

// Doses
export const submitDosePhoto = (doseId, form) =>
  api.post(`/doses/${doseId}/submit-photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
export const partialOverride = (doseId, reason) =>
  api.post(`/doses/${doseId}/partial-override`, { reason });

// Adherence
export const getAdherenceHistory = () => api.get('/adherence/history');
export const getAdherenceStats   = () => api.get('/adherence/stats');

// Push
export const subscribePush = (sub)  => api.post('/push/subscribe', { subscription: sub });
export const sendTestPush  = ()     => api.post('/push/test');
export const getVapidKey   = ()     => api.get('/push/vapid-key');

export default api;
