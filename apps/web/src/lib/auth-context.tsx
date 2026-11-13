'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { UserRole } from '@amplyra/shared';
import {
  apiFetch,
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from './api';

export interface CurrentUserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  emailVerifiedAt: string | null;
  business?: {
    id: string;
    name: string;
    industry: string;
    city?: string | null;
    state?: string | null;
  } | null;
  creator?: {
    id: string;
    displayName: string;
    city?: string | null;
    state?: string | null;
  } | null;
}

interface AuthContextValue {
  user: CurrentUserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<CurrentUserProfile>;
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole.BUSINESS | UserRole.CREATOR;
  }) => Promise<CurrentUserProfile>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const { accessToken } = getStoredTokens();
    if (!accessToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await apiFetch<CurrentUserProfile>('/auth/me');
      setUser(me);
    } catch {
      clearStoredTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{
      user: CurrentUserProfile;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredTokens(res.accessToken, res.refreshToken);
    const fullMe = await apiFetch<CurrentUserProfile>('/auth/me');
    setUser(fullMe);
    return fullMe;
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      fullName: string;
      role: UserRole.BUSINESS | UserRole.CREATOR;
    }) => {
      const res = await apiFetch<{
        user: CurrentUserProfile;
        accessToken: string;
        refreshToken: string;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStoredTokens(res.accessToken, res.refreshToken);
      const fullMe = await apiFetch<CurrentUserProfile>('/auth/me');
      setUser(fullMe);
      return fullMe;
    },
    [],
  );

  const logout = useCallback(async () => {
    const { refreshToken } = getStoredTokens();
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore logout error
    }
    clearStoredTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
