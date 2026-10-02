"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Login } from './Login';
import { Signup } from './Signup';
import { AdminDashboard } from './AdminDashboard';
import { StudentApp } from './StudentApp';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner';
import { supabase } from './utils/supabase/client';
import { reactivateIfNeeded } from './services/account';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { GraduationCap, Users, ArrowRight } from 'lucide-react';
import { DASHBOARD_LOGOUT_EVENT } from '../lib/dashboard-events';

export default function App() {
  const pathname = usePathname();
  const router = useRouter();
  const portalMode = pathname.startsWith('/admin')
    ? 'admin'
    : pathname.startsWith('/student')
      ? 'student'
      : null;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname.startsWith('/admin/dashboard')) {
      router.replace('/admin/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  const checkSession = useCallback(async () => {
    if (portalMode !== 'admin') return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.access_token) {
        if (!(await reactivateIfNeeded(session))) return;
        const userRole = session.user?.user_metadata?.role;

        if (userRole === 'student') {
          await supabase.auth.signOut();
          setIsLoading(false);
          return;
        }

        // Try to fetch teacher data
        const teacherResponse = await fetch(`/api/teacher/profile`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (teacherResponse.ok) {
          const data = await teacherResponse.json();
          setCurrentUser(data.teacher);
          setAccessToken(session.access_token);
          setIsAuthenticated(true);
          if (!window.location.pathname.startsWith('/admin/dashboard')) {
            router.replace('/admin/dashboard');
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
  }, [portalMode, router]);

  useEffect(() => {
    if (portalMode === 'admin') {
      void Promise.resolve().then(checkSession);
    }
  }, [checkSession, portalMode]);

  const handleLogin = async (email: string, password: string) => {
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

        if (userRole === 'student') {
          toast.error('This account is registered as a student. Please use the Student Portal to login.');
          await supabase.auth.signOut();
          throw new Error('Wrong portal');
        }

        // Fetch user data from backend
        const response = await fetch(`/api/teacher/profile`, {
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData.teacher);
          setAccessToken(data.session.access_token);
          setIsAuthenticated(true);
          router.replace('/admin/dashboard');
          toast.success(`Welcome back, ${userData.teacher.name}!`);
        } else {
          let errorMessage = 'Failed to fetch user data';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // ignore
          }

          if (response.status === 403) {
            toast.error('Access denied. This account is not registered as a teacher. Please use the Student Portal.');
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
    }
  };

  const handleSignup = async (formData: any) => {
    try {
      const response = await fetch(`/api/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Signup failed');
        throw new Error(data.error);
      }

      toast.success('Account created successfully! Please sign in.');
      router.push('/admin/login');
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setAccessToken(null);
      setIsAuthenticated(false);
      router.replace('/');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  useEffect(() => {
    if (!pathname.startsWith('/admin/dashboard')) return;
    const logout = () => { void handleLogout(); };
    window.addEventListener(DASHBOARD_LOGOUT_EVENT, logout);
    return () => window.removeEventListener(DASHBOARD_LOGOUT_EVENT, logout);
  }, [pathname]);

  if (portalMode === 'admin' && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Landing page - choose portal
  if (!portalMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-lg rounded-full mb-6 shadow-2xl">
              <GraduationCap className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Dental College Portal</h1>
            <p className="text-xl text-white/90">Choose your portal to continue</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admin Portal Card */}
            <Card 
              className="border-0 shadow-2xl bg-white/95 backdrop-blur-lg hover:shadow-3xl transition-all cursor-pointer hover:-translate-y-1"
              onClick={() => router.push('/admin/login')}
            >
              <CardHeader className="text-center pb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4 mx-auto">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl">Admin Portal</CardTitle>
                <CardDescription className="text-base">
                  For teachers and administrators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Manage student records
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Add and update marks
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Create assignments and tasks
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Track student progress
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 shadow-lg">
                  Access Admin Portal
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Student Portal Card */}
            <Card 
              className="border-0 shadow-2xl bg-white/95 backdrop-blur-lg hover:shadow-3xl transition-all cursor-pointer hover:-translate-y-1"
              onClick={() => router.push('/student/login')}
            >
              <CardHeader className="text-center pb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-4 mx-auto">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl">Student Portal</CardTitle>
                <CardDescription className="text-base">
                  For dental college students
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    View grades and scores
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    Track experience points
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    View assigned tasks
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    Receive notifications
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white border-0 shadow-lg">
                  Access Student Portal
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        <Toaster />
      </div>
    );
  }

  // Student Portal
  if (portalMode === 'student') {
    return (
      <>
        <StudentApp onBackToLanding={() => router.push('/')} />
        <Toaster />
      </>
    );
  }

  // Admin Portal
  if (!isAuthenticated) {
    if (pathname === '/admin/signup') {
      return (
        <>
          <Signup 
            onSignup={handleSignup}
            onSwitchToLogin={() => router.push('/admin/login')}
            onBack={() => router.push('/')}
          />
          <Toaster />
        </>
      );
    }
    return (
      <>
        <Login 
          onLogin={handleLogin}
          onSwitchToSignup={() => router.push('/admin/signup')}
          onBack={() => router.push('/')}
        />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <AdminDashboard 
        currentUser={currentUser} 
        onLogout={handleLogout}
        accessToken={accessToken!}
      />
      <Toaster />
    </>
  );
}
