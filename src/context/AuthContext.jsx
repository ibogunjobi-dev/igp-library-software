// ============================================================================
// Authentication context (token-based, against the local API server).
//
// Phase 1 only admits the "admin" role (the Librarian). The role value is
// exposed so Phase 2 route guards (fc / member) can be switched on without
// re-architecting.
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken, ApiError } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // On load, validate any stored token by resolving the current user.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      try {
        const { user: u } = await api.get('/auth/me');
        if (active) { setUser(u); setRole(u.role); }
      } catch {
        setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function signIn(email, password) {
    const { token, user: u } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(u);
    setRole(u.role);
    return u;
  }

  function signOut() {
    setToken(null);
    setUser(null);
    setRole(null);
  }

  const value = { user, role, loading, signIn, signOut, isAdmin: role === 'admin' };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}

export { ApiError };
