import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, loginUser, logoutUser, registerParticipant } from '../api/auth';

const AuthContext = createContext(null);

export const roleDefaultPath = (role) => {
  if (role === 'participant') return '/participant/dashboard';
  if (role === 'organizer') return '/organizer/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/login';
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('felicity_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('felicity_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let mounted = true;
    getMe()
      .then((res) => {
        if (!mounted) return;
        setUser(res.data);
        localStorage.setItem('felicity_user', JSON.stringify(res.data));
      })
      .catch(() => {
        if (!mounted) return;
        localStorage.removeItem('felicity_token');
        localStorage.removeItem('felicity_user');
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const persistSession = useCallback((session) => {
    const nextToken = session.token;
    const nextUser = session.user;
    localStorage.setItem('felicity_token', nextToken);
    localStorage.setItem('felicity_user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const login = useCallback(async (payload) => {
    const res = await loginUser(payload);
    persistSession(res.data);
    return res.data;
  }, [persistSession]);

  const signupParticipant = useCallback(async (payload) => {
    const res = await registerParticipant(payload);
    persistSession(res.data);
    return res.data;
  }, [persistSession]);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // ignore client-side logout errors
    }

    localStorage.removeItem('felicity_token');
    localStorage.removeItem('felicity_user');
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      signupParticipant,
      logout,
      setUser,
    }),
    [token, user, loading, login, signupParticipant, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
