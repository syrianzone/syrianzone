import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  authErrorCode,
  type AuthErrorCode,
} from '@/lib/auth/errors';
import {
  nativeAuthService,
  type AuthService,
} from '@/lib/auth/service';
import type { AuthUser } from '@/lib/auth/types';

export interface AuthContextType {
  clearError: () => void;
  error: AuthErrorCode | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  user: AuthUser | null;
}

interface AuthProviderProps {
  service?: AuthService;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
  service = nativeAuthService,
}: PropsWithChildren<AuthProviderProps>) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const operationRef = useRef(0);

  useEffect(() => {
    let active = true;
    const operation = ++operationRef.current;
    void service
      .bootstrap()
      .then((nextUser) => {
        if (active && operationRef.current === operation) {
          setUser(nextUser);
        }
      })
      .catch((cause: unknown) => {
        if (active && operationRef.current === operation) {
          setUser(null);
          setError(authErrorCode(cause, 'bootstrap_failed'));
        }
      })
      .finally(() => {
        if (active && operationRef.current === operation) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [service]);

  const clearError = useCallback(() => setError(null), []);

  const refreshUser = useCallback(async () => {
    const operation = ++operationRef.current;
    setLoading(true);
    setError(null);
    try {
      const nextUser = await service.refreshUser();
      if (operationRef.current === operation) {
        setUser(nextUser);
      }
    } catch (cause) {
      if (operationRef.current === operation) {
        setUser(null);
        setError(authErrorCode(cause, 'refresh_failed'));
      }
    } finally {
      if (operationRef.current === operation) {
        setLoading(false);
      }
    }
  }, [service]);

  const login = useCallback(async () => {
    const operation = ++operationRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await service.login();
      if (
        operationRef.current === operation &&
        result.status === 'authenticated'
      ) {
        setUser(result.user);
      }
    } catch (cause) {
      if (operationRef.current === operation) {
        setError(authErrorCode(cause, 'login_failed'));
      }
    } finally {
      if (operationRef.current === operation) {
        setLoading(false);
      }
    }
  }, [service]);

  const logout = useCallback(async () => {
    const operation = ++operationRef.current;
    let sessionCleared = true;
    setLoading(true);
    setError(null);
    try {
      await service.logout();
    } catch (cause) {
      const code = authErrorCode(cause, 'logout_failed');
      sessionCleared = code !== 'logout_incomplete';
      if (operationRef.current === operation) {
        setError(code);
      }
    } finally {
      if (operationRef.current === operation) {
        if (sessionCleared) {
          setUser(null);
        }
        setLoading(false);
      }
    }
  }, [service]);

  const value = useMemo<AuthContextType>(
    () => ({
      clearError,
      error,
      isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
      isSuperAdmin: user?.role === 'superadmin',
      loading,
      login,
      logout,
      refreshUser,
      user,
    }),
    [clearError, error, loading, login, logout, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/*
PORT STATUS
  source:     resources/js/Contexts/AuthContext.tsx (62 lines)
  confidence: high
  todos:      0
  notes:      Secure bearer bootstrap replaces Inertia session hydration.
*/
