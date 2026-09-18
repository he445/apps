/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  updateProfile: (data: any) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  impersonateUser: (token: string, user: User) => void;
  exitImpersonation: () => void;
  isAuthenticated: boolean;
  isProfessional: boolean;
  isPatient: boolean;
  isAdmin: boolean;
  isImpersonated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEYS = {
  token: 'ojanuan_token',
  user: 'ojanuan_user',
  adminToken: 'ojanuan_admin_token',
  adminUser: 'ojanuan_admin_user',
};

const readStoredSession = () => {
  if (typeof window === 'undefined') return { token: null as string | null, user: null as User | null };

  try {
    const storedToken = window.sessionStorage.getItem(STORAGE_KEYS.token);
    const storedUser = window.sessionStorage.getItem(STORAGE_KEYS.user);

    if (!storedToken || !storedUser) {
      return { token: null, user: null };
    }

    const parsedUser = JSON.parse(storedUser) as User;
    return { token: storedToken, user: parsedUser };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEYS.token);
    window.sessionStorage.removeItem(STORAGE_KEYS.user);
    return { token: null, user: null };
  }
};

const writeStoredSession = (token: string | null, user: User | null) => {
  if (typeof window === 'undefined') return;

  if (!token || !user) {
    window.sessionStorage.removeItem(STORAGE_KEYS.token);
    window.sessionStorage.removeItem(STORAGE_KEYS.user);
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEYS.token, token);
  window.sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { token: storedToken, user: storedUser } = readStoredSession();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: receivedToken, user: receivedUser } = response.data;
      
      writeStoredSession(receivedToken, receivedUser);
      
      setToken(receivedToken);
      setUser(receivedUser);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', data);
      const { token: receivedToken, user: receivedUser } = response.data;

      writeStoredSession(receivedToken, receivedUser);

      setToken(receivedToken);
      setUser(receivedUser);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    writeStoredSession(null, null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_KEYS.adminToken);
      window.sessionStorage.removeItem(STORAGE_KEYS.adminUser);
    }
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
  };

  const updateProfile = async (data: any) => {
    try {
      const response = await api.put('/users/profile', data);
      const updatedUser = response.data.user;
      const currentToken = response.data.token || token;
      if (currentToken) {
        writeStoredSession(currentToken, updatedUser);
      }
      setToken(currentToken);
      setUser(updatedUser);
    } catch (error) {
      throw error;
    }
  };

  const deleteAccount = async (password: string) => {
    try {
      await api.delete('/users/me', { data: { password } });
      writeStoredSession(null, null);
      setToken(null);
      setUser(null);
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
    } catch (error) {
      throw error;
    }
  };

  const impersonateUser = (targetToken: string, targetUser: User) => {
    if (typeof window !== 'undefined') {
      // Save original admin session if not already saved
      if (!window.sessionStorage.getItem(STORAGE_KEYS.adminToken) && token && user) {
        window.sessionStorage.setItem(STORAGE_KEYS.adminToken, token);
        window.sessionStorage.setItem(STORAGE_KEYS.adminUser, JSON.stringify(user));
      }
    }

    const simUser: User = { ...targetUser, isImpersonated: true };
    writeStoredSession(targetToken, simUser);
    setToken(targetToken);
    setUser(simUser);

    if (typeof window !== 'undefined') {
      if (targetUser.role === 'PROFESSIONAL') {
        window.location.assign('/pro/dashboard');
      } else {
        window.location.assign('/paciente/dashboard');
      }
    }
  };

  const exitImpersonation = () => {
    if (typeof window === 'undefined') return;

    const savedAdminToken = window.sessionStorage.getItem(STORAGE_KEYS.adminToken);
    const savedAdminUser = window.sessionStorage.getItem(STORAGE_KEYS.adminUser);

    if (savedAdminToken && savedAdminUser) {
      // Sem esta proteção, um storage corrompido lançava aqui e deixava o admin
      // preso na simulação sem saída — e ErrorBoundary não captura erro em
      // handler de evento, só em render. Degradar para logout sempre dá uma saída.
      let parsedAdmin: User;
      try {
        parsedAdmin = JSON.parse(savedAdminUser) as User;
      } catch {
        logout();
        return;
      }
      writeStoredSession(savedAdminToken, parsedAdmin);
      window.sessionStorage.removeItem(STORAGE_KEYS.adminToken);
      window.sessionStorage.removeItem(STORAGE_KEYS.adminUser);
      setToken(savedAdminToken);
      setUser(parsedAdmin);
      window.location.assign('/admin/dashboard');
    } else {
      logout();
    }
  };

  const isAuthenticated = !!token;
  const isProfessional = user?.role === 'PROFESSIONAL';
  const isPatient = user?.role === 'PATIENT';
  const isAdmin = user?.role === 'ADMIN';
  const isImpersonated = !!user?.isImpersonated || (typeof window !== 'undefined' && !!window.sessionStorage.getItem(STORAGE_KEYS.adminToken));

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        deleteAccount,
        impersonateUser,
        exitImpersonation,
        isAuthenticated,
        isProfessional,
        isPatient,
        isAdmin,
        isImpersonated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
