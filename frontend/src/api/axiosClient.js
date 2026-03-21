// Smart-Fleet IoT — Axios Client
// TanQHoang © 2026
// withCredentials: true ensures httpOnly cookies are sent with every request.
// The 401 interceptor handles token refresh — fires once, never loops.

import axios from 'axios';

const axiosClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // Required for httpOnly cookie auth
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// ─── Response Interceptor — handle 401 with token refresh ────────────────────
let isRefreshing = false;
let failedQueue = [];

function processQueue(error) {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve()));
  failedQueue = [];
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => axiosClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axiosClient.post('/auth/refresh');
        processQueue(null);
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Refresh failed — redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
