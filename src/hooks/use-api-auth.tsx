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
import type { ApiUser } from "@/lib/api-types";

interface ApiAuthContextValue {
  user: ApiUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  register: (payload: API.RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const ApiAuthContext = createContext<ApiAuthContextValue | undefined>(undefined);

export function ApiAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = API.getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    API.fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) {
          API.setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, twoFactorCode?: string) => {
    const result = await API.login(email, password, twoFactorCode);
    if (result.requiresTwoFactor) {
      const err = new Error("requiresTwoFactor");
      throw err;
    }
    if (result.token) API.setToken(result.token);
    if (result.user) {
      setUser(result.user);
    } else {
      setUser(await API.fetchMe());
    }
  }, []);

  const register = useCallback(async (payload: API.RegisterPayload) => {
    const result = await API.register(payload);
    if (result.token) API.setToken(result.token);
    if (result.user) {
      setUser(result.user);
    } else {
      setUser(await API.fetchMe());
    }
  }, []);

  const logout = useCallback(async () => {
    await API.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!API.getToken()) return;
    setUser(await API.fetchMe());
  }, []);

  const value = useMemo<ApiAuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <ApiAuthContext.Provider value={value}>{children}</ApiAuthContext.Provider>;
}

export function useApiAuth() {
  const ctx = useContext(ApiAuthContext);
  if (!ctx) throw new Error("useApiAuth must be used within ApiAuthProvider");
  return ctx;
}

export async function requestPasswordReset(email: string) {
  await API.api.post("/auth/forgot-password", { email });
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  await API.api.post("/auth/reset-password", { email, code, newPassword });
}
