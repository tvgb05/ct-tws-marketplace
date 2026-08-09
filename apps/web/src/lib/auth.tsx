"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AuthUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  phoneNumber: string | null;
  facebookProfileUrl: string | null;
  profileCompleted: boolean;
  contactPrivacyAccepted: boolean;
  role: "USER" | "ADMIN";
  joinedAt: string;
  canPostListings: boolean;
  postingRestrictionReason: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const publicPaths = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/admin/login",
  "/privacy",
  "/terms",
]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        setUser(null);
        if (!publicPaths.has(pathname))
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const authenticatedUser = (await response.json()) as AuthUser;
      setUser(authenticatedUser);
      if (
        authenticatedUser.role === "USER" &&
        !authenticatedUser.profileCompleted &&
        pathname !== "/complete-profile" &&
        !publicPaths.has(pathname)
      ) {
        router.replace(
          `/complete-profile?next=${encodeURIComponent(pathname)}`,
        );
      }
    } catch {
      setUser(null);
      if (!publicPaths.has(pathname))
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    // Authentication state is intentionally synchronized with the backend session on navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      window.location.assign("/login");
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, logout }),
    [user, loading, refresh, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
