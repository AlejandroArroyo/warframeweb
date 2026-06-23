import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserDTO } from '@warframe/shared';

const API_BASE = '/api';

interface AuthContextValue {
  user: UserDTO | null;
  token: string | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  updateUser: (updated: UserDTO) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'wf_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Al iniciar, si hay token guardado, verificar que siga válido
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Token invalid');
        return res.json();
      })
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        // Token expirado o inválido
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

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
    setToken(data.token);
    setUser(data.user);
  }, []);

  const updateUser = useCallback((updated: UserDTO) => {
    setUser(updated);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
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
