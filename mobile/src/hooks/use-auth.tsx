import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as API from "@/lib/api";
import type { ApiUser } from "@/lib/types";

export class TwoFactorRequiredError extends Error {
  constructor() {
    super("requiresTwoFactor");
  }
}

interface AuthContextValue {
  user: ApiUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  register: (payload: API.RegisterPayload) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await API.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await API.fetchMe();
        if (!cancelled) {
          setUser(me);
          await API.cacheUserForBootstrap(me);
        }
      } catch {
        if (!cancelled) {
          await API.setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, twoFactorCode?: string) => {
    const result = await API.login(email, password, twoFactorCode);
    if (result.requiresTwoFactor) {
      throw new TwoFactorRequiredError();
    }
    if (result.token) await API.setToken(result.token);
    const me = result.user ?? (await API.fetchMe());
    setUser(me);
    await API.cacheUserForBootstrap(me);
  }, []);

  const register = useCallback(async (payload: API.RegisterPayload) => {
    const result = await API.register(payload);
    if (result.token) await API.setToken(result.token);
    const me = result.user ?? (await API.fetchMe());
    setUser(me);
    await API.cacheUserForBootstrap(me);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const result = await API.googleLogin(idToken);
    if (result.token) await API.setToken(result.token);
    const me = result.user ?? (await API.fetchMe());
    setUser(me);
    await API.cacheUserForBootstrap(me);
  }, []);

  const logout = useCallback(async () => {
    await API.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!(await API.getToken())) return;
    const me = await API.fetchMe();
    setUser(me);
    await API.cacheUserForBootstrap(me);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, loginWithGoogle, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
