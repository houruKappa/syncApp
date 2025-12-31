import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/slices/authSlice';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Request interceptor to add token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Handle 401 errors
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return axios(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                try {
                    console.log('Attempting to refresh token...');
                    const response = await axios.post(`${API_URL}/api/auth/refresh`, {
                        refreshToken,
                    });
                    const { accessToken } = response.data.data;
                    localStorage.setItem('accessToken', accessToken);
                    console.log('Token refreshed successfully');

                    // Update Redux store with new token
                    const currentState = store.getState();
                    if (currentState.auth.user) {
                        store.dispatch({
                            type: 'auth/setCredentials',
                            payload: {
                                user: currentState.auth.user,
                                accessToken: accessToken,
                                refreshToken: refreshToken
                            }
                        });
                    }

                    processQueue(null, accessToken);
                    isRefreshing = false;

                    // Retry the original request
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return axios(originalRequest);
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    processQueue(refreshError, null);
                    isRefreshing = false;

                    // Refresh failed, logout and redirect
                    store.dispatch(logout());
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            } else {
                console.log('No refresh token available, logging out');
                isRefreshing = false;
                store.dispatch(logout());
                window.location.href = '/login';
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
