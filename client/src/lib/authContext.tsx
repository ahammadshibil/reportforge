import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";

type AuthUser = { email: string };
type AuthState = {
  user: AuthUser | null;
  configured: boolean;
};

type Ctx = {
  user: AuthUser | null;
  configured: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<AuthState>({
    queryKey: ["/api/auth/me"],
  });

  const loginMut = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await apiRequest("POST", "/api/auth/login", { email, password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: data?.user ?? null,
        configured: data?.configured ?? false,
        isLoading,
        login: async (email, password) => {
          await loginMut.mutateAsync({ email, password });
        },
        logout: async () => {
          await logoutMut.mutateAsync();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
