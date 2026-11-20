"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { GraduationCap, Mail, Lock, LogIn, UserPlus, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { LoadingSpinner } from './ui/loading';

interface StudentLoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSwitchToSignup: () => void;
  onSwitchToFaculty: () => void;
}

export function StudentLogin({ onLogin, onSwitchToSignup, onSwitchToFaculty }: StudentLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onLogin(email, password);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mobile-ui auth-screen flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <Button
          onClick={onSwitchToFaculty}
          variant="ghost"
          className="auth-back-button mb-4"
          aria-label="Back to portal selection"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="auth-back-label">Back to Portal Selection</span>
        </Button>
        
        <div className="auth-heading text-center mb-8">
          <div className="auth-heading-icon mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="size-7" />
          </div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-foreground">Student Portal</h1>
        </div>

        <Card className="auth-panel border-border/80 shadow-sm">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl text-center">Welcome Back!</CardTitle>
            <CardDescription className="text-center">
              Sign in to track your progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(value => !value)}
                  >
                    {showPassword
                      ? <EyeOff aria-hidden="true" className="size-4" />
                      : <Eye aria-hidden="true" className="size-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner className="size-4 text-primary-foreground" />
                    Signing in...
                  </div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Don&apos;t have an account?
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={onSwitchToSignup}
                className="w-full h-11"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account
              </Button>

              <p className="pt-2 text-center text-xs text-muted-foreground">
                Are you a Faculty Member?{' '}
                <button
                  type="button"
                  onClick={onSwitchToFaculty}
                  className="font-medium text-primary hover:underline"
                >
                  Switch to Faculty Portal
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
