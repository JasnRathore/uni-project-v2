"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminDashboard } from "./AdminDashboard";
import { Toaster } from "./ui/sonner";
import { supabase } from "./utils/supabase/client";
import { reactivateIfNeeded } from "./services/account";
import { DASHBOARD_LOGOUT_EVENT } from "../lib/dashboard-events";

export function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<unknown>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      if (!(await reactivateIfNeeded(session))) return;
      if (session.user?.user_metadata?.role === "student") {
        await supabase.auth.signOut();
        return;
      }

      const response = await fetch("/api/teacher/profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        await supabase.auth.signOut();
        return;
      }
      const data = await response.json();
      setCurrentUser(data.teacher);
      setAccessToken(session.access_token);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Session check error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setAccessToken(null);
      setIsAuthenticated(false);
      router.replace("/");
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  }, [router]);

  useEffect(() => {
    const logout = () => void handleLogout();
    window.addEventListener(DASHBOARD_LOGOUT_EVENT, logout);
    return () => window.removeEventListener(DASHBOARD_LOGOUT_EVENT, logout);
  }, [handleLogout]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/admin/login");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated || !accessToken) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AdminDashboard currentUser={currentUser} onLogout={handleLogout} accessToken={accessToken} />
      <Toaster />
    </>
  );
}
