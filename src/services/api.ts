/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';

const AUTH_TOKEN_KEY = 'ojanuan_token';

const storage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore storage availability issues
    }
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore storage availability issues
    }
  },
};

const getAuthToken = () => storage.getItem(AUTH_TOKEN_KEY);

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  if (!envUrl) return '/api';
  return envUrl.endsWith('/api/v1') 
    ? envUrl 
    : `${envUrl.replace(/\/$/, '')}/api/v1`;
};

// Instance pointing to the API
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const reqUrl = error.config?.url || '';
      const isPublicRoute = reqUrl.includes('/auth/invitation') || reqUrl.includes('/invitations') || reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register');
      const isPublicPath = window.location.pathname.includes('/login') || window.location.pathname.includes('/cadastro') || window.location.pathname.includes('/convite');

      if (!isPublicRoute && !isPublicPath) {
        console.warn('Unauthorized or session expired, logging out...');
        storage.removeItem('ojanuan_token');
        storage.removeItem('ojanuan_user');
        if (typeof window !== 'undefined') {
          window.location.assign('/login');
        }
      }
    }
    return Promise.reject(error);
  }
);
