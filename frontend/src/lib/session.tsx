"use client";

import * as React from "react";
import { api, errorMessage } from "@/lib/api";
import type { User } from "@/lib/types";

type RegisterInput = { firstName: string; lastName: string; email: string; password: string; phone?: string };

type SessionContextValue = {
  user: User | null;
  status: "loading" | "authenticated" | "guest";
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (input: Partial<Pick<User, "firstName" | "lastName" | "phone" | "avatarUrl">>) => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

type AuthPayload = { user: User; accessToken: string };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<"loading" | "authenticated" | "guest">("loading");

  const refresh = React.useCallback(async () => {
    try {
      const data = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = React.useCallback(async (email: string, password: string) => {
    try {
      const data = await api.post<AuthPayload>("/auth/login", { email, password }, { noRetry: true });
      setUser(data.user);
      setStatus("authenticated");
      return data.user;
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }, []);

  const register = React.useCallback(async (input: RegisterInput) => {
    try {
      const data = await api.post<AuthPayload>("/auth/register", input, { noRetry: true });
      setUser(data.user);
      setStatus("authenticated");
      return data.user;
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await api.post("/auth/logout", {}, { noRetry: true });
    } catch {
      // signing out locally is what matters to the visitor
    }
    setUser(null);
    setStatus("guest");
  }, []);

  const updateProfile = React.useCallback(
    async (input: Partial<Pick<User, "firstName" | "lastName" | "phone" | "avatarUrl">>) => {
      const data = await api.patch<{ user: User }>("/profile", input);
      setUser(data.user);
    },
    [],
  );

  const value = React.useMemo(
    () => ({ user, status, login, register, logout, updateProfile, refresh }),
    [user, status, login, register, logout, updateProfile, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
