"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Login } from "./Login";
import { Signup, type SignupCredentials } from "./Signup";
import { supabase } from "./utils/supabase/client";
import { reactivateIfNeeded } from "./services/account";
import { Toaster } from "./ui/sonner";

type FacultyAuthPageProps = {
  mode: "login" | "signup";
};

export function FacultyAuthPage({ mode }: FacultyAuthPageProps) {
  const router = useRouter();

  const handleLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message = error.message === "Invalid login credentials"
        ? "Invalid email or password. Please check your credentials or sign up for a new account."
        : error.message.includes("fetch")
          ? "Connection error. Please check your internet connection and try again."
          : error.message;
      toast.error(message);
      return;
    }

    if (!data.session) return;
    if (!(await reactivateIfNeeded(data.session))) throw new Error("Account reactivation cancelled");
    if (data.session.user?.user_metadata?.role === "student") {
      toast.error("This account is registered as a student. Please use the Student Portal to login.");
      await supabase.auth.signOut();
      throw new Error("Wrong portal");
    }

    const response = await fetch("/api/teacher/profile", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (!response.ok) {
      let message = "Failed to fetch user data";
      try {
        const errorData = await response.json();
        message = errorData.error || message;
      } catch {
        // The server may return an empty error response.
      }
      if (response.status === 403) {
        message = "Access denied. This account is not registered as a teacher. Please use the Student Portal.";
      }
      toast.error(message);
      await supabase.auth.signOut();
      throw new Error(message);
    }

    const userData = await response.json();
    toast.success(`Welcome back, ${userData.teacher.name}!`);
    router.replace("/faculty/dashboard");
  };

  const handleSignup = async (formData: SignupCredentials) => {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const data = await response.json();
    if (!response.ok) {
      const message = data.detail || data.error || "Signup failed";
      toast.error(message);
      throw new Error(message);
    }
    toast.success("Account created successfully! Please sign in.");
    router.replace("/faculty/login");
  };

  return (
    <>
      {mode === "signup" ? (
        <Signup
          onSignup={handleSignup}
          onSwitchToLogin={() => router.push("/faculty/login")}
          onBack={() => router.push("/")}
        />
      ) : (
        <Login
          onLogin={handleLogin}
          onSwitchToSignup={() => router.push("/faculty/signup")}
          onBack={() => router.push("/")}
        />
      )}
      <Toaster />
    </>
  );
}
