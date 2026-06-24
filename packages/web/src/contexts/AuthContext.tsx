import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserDTO } from '@warframe/shared';

// Misma lógica que en client.ts — runtime detection
function resolveBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '/api';
    }
  }
  return 'https://warframeweb-production.up.railway.app/api';
}
const API_BASE = resolveBaseUrl();

interface AuthContextValue {
  user: UserDTO | null;
  token: string | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  updateUser: (updated: UserDTO) => void;
  setUserFromToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'wf_token';
const USER_KEY = 'wf_user';

/** Decodifica el payload de un JWT sin verificar firma (solo para lectura en frontend) */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(() => {
    // Intentar restaurar usuario desde localStorage
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Al iniciar, si hay token guardado, verificar que siga válido
  useEffect(() => {
    if (!token) {
      console.log('[Auth] No token found in localStorage');
      setLoading(false);
      return;
    }

    // Si ya tenemos el usuario restaurado de localStorage y el token coincide, no hacemos fetch
    if (user) {
      console.log('[Auth] User restored from localStorage:', user.username);
      setLoading(false);
      return;
    }

    console.log('[Auth] Token found, validating with', `${API_BASE}/auth/me`);
    fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        console.log('[Auth] Response status:', res.status);
        if (!res.ok) throw new Error(`Token invalid (${res.status})`);
        return res.json();
      })
      .then((userData) => {
        console.log('[Auth] Login successful:', userData.username);
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      })
      .catch((err) => {
        console.error('[Auth] Token validation failed:', err.message);
        if (err.message.includes('Failed to fetch')) {
          console.error('[Auth] Possible CORS or network error - check that API is reachable');
        }
        // No borramos el token inmediatamente - puede ser error de red temporal
        setUser(null);
        localStorage.removeItem(USER_KEY);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const setUserFromToken = useCallback((jwt: string) => {
    const payload = decodeJwtPayload(jwt);
    if (!payload || !payload.userId || !payload.username) {
      console.error('[Auth] Invalid JWT payload:', payload);
      return;
    }
    const userData: UserDTO = {
      id: payload.userId as string,
      username: payload.username as string,
      isAdmin: payload.isAdmin as boolean || false,
      discordId: payload.discordId as string | undefined,
      platform: null,
      masteryRank: 0,
      reputation: 0,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(TOKEN_KEY, jwt);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
  }, []);

  const login = useCallback(async (username: string) => {
    const res = await fetch(`${API_BASE}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const updateUser = useCallback((updated: UserDTO) => {
    setUser(updated);
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        updateUser,
        setUserFromToken,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Hook para obtener el header de Authorization con el token actual.
 * Útil para llamadas API manuales fuera del client.ts.
 */
export function useAuthHeader(): Record<string, string> {
  const { token } = useAuth();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
