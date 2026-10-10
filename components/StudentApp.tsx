"use client";
import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { StudentLogin } from './StudentLogin';
import { StudentSignup } from './StudentSignup';
import { StudentDashboard } from './StudentDashboard';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner';
import { supabase } from './utils/supabase/client';
import { reactivateIfNeeded } from './services/account';
import { DASHBOARD_LOGOUT_EVENT } from '../lib/dashboard-events';
import { LoadingScreen } from './ui/loading';

interface StudentAppProps {
  onBackToLanding?: () => void;
}

export function StudentApp({ onBackToLanding }: StudentAppProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname.startsWith('/student/dashboard')) {
      router.replace('/student/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  useEffect(() => {
    if (!pathname.startsWith('/student/dashboard')) return;
    const logout = () => {
      void (async () => {
        try {
          await supabase.auth.signOut();
          setCurrentStudent(null);
          setAccessToken(null);
          setIsAuthenticated(false);
          toast.success('Logged out successfully');
          router.replace('/');
        } catch (error) {
          console.error('Logout error:', error);
          toast.error('Logout failed');
        }
      })();
    };
    window.addEventListener(DASHBOARD_LOGOUT_EVENT, logout);
    return () => window.removeEventListener(DASHBOARD_LOGOUT_EVENT, logout);
  }, [pathname, router]);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.access_token) {
        if (!(await reactivateIfNeeded(session))) return;
        const userRole = session.user?.user_metadata?.role;

        if (userRole === 'teacher') {
          await supabase.auth.signOut();
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/student/profile`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentStudent(data.student);
          setAccessToken(session.access_token);
          setIsAuthenticated(true);
          if (!pathname.startsWith('/student/dashboard')) {
            router.replace('/student/dashboard');
          }
        } else {
          await supabase.auth.signOut();
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          toast.error('Invalid email or password. Please check your credentials or sign up for a new account.');
        } else if (error.message.includes('fetch')) {
          toast.error('Connection error. Please check your internet connection and try again.');
        } else {
          toast.error(error.message);
        }
        throw error;
      }

      if (data.session) {
        if (!(await reactivateIfNeeded(data.session))) throw new Error('Account reactivation cancelled');
        const userRole = data.session.user?.user_metadata?.role;

        if (userRole === 'teacher') {
          toast.error('This account is registered as a teacher. Please use the Faculty Portal to login.');
          await supabase.auth.signOut();
          throw new Error('Wrong portal');
        }

        const response = await fetch(`/api/student/profile`, {
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setCurrentStudent(userData.student);
          setAccessToken(data.session.access_token);
          setIsAuthenticated(true);
          router.replace('/student/dashboard');
          toast.success(`Welcome back, ${userData.student.name}!`);
        } else {
          let errorMessage = 'Failed to fetch student data';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // ignore
          }

          if (response.status === 403) {
            toast.error('Access denied. This account is not registered as a student. Please use the Faculty Portal.');
          } else {
            toast.error(errorMessage);
          }
          await supabase.auth.signOut();
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (formData: any) => {
    try {
      const response = await fetch(`/api/student/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          role: 'student'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Signup failed');
        throw new Error(data.error);
      }

      toast.success('Account created successfully! Please sign in.');
      router.push('/student/login');
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const handleSwitchToFaculty = () => {
    if (onBackToLanding) {
      onBackToLanding();
    } else {
      router.push('/');
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    if (pathname === '/student/signup') {
      return (
        <>
          <StudentSignup 
            onSignup={handleSignup}
            onSwitchToLogin={() => router.push('/student/login')}
            onBack={onBackToLanding}
          />
          <Toaster />
        </>
      );
    }
    return (
      <>
        <StudentLogin 
          onLogin={handleLogin}
          onSwitchToSignup={() => router.push('/student/signup')}
          onSwitchToFaculty={handleSwitchToFaculty}
        />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <StudentDashboard 
        student={currentStudent} 
        accessToken={accessToken}
        projectId=""
      />
      <Toaster />
    </>
  );
}
