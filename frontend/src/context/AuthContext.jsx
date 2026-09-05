import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, api, onSessionExpired, setAccessToken } from '@/services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const expiredRef = useRef(false);

  // On first load, try the refresh cookie. A signed-in user who reloads the
  // page stays signed in without ever storing a token where script can read it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await api.refreshSession();
      if (cancelled) return;
      if (session?.user) {
        setUser(session.user);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        expiredRef.current = true;
        setUser(null);
        setStatus('anonymous');
      }),
    [],
  );

  const adopt = useCallback((session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
    expiredRef.current = false;
    return session.user;
  }, []);

  const login = useCallback(async (credentials) => adopt(await authApi.login(credentials)), [adopt]);
  const register = useCallback(async (payload) => adopt(await authApi.register(payload)), [adopt]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const { user: updated } = await authApi.updateProfile(payload);
    setUser(updated);
    return updated;
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: fresh } = await authApi.me();
    setUser(fresh);
    return fresh;
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      isAdmin: user?.role === 'admin',
      hasChosenExam: Boolean(user?.examStage),
      sessionExpired: expiredRef.current,
      login,
      register,
      logout,
      updateProfile,
      refreshUser,
    }),
    [user, status, login, register, logout, updateProfile, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
