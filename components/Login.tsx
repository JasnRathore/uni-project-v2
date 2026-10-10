"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Mail, Lock, Eye, EyeOff, GraduationCap, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ConnectionTest } from './ConnectionTest';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSwitchToSignup: () => void;
  onBack: () => void;
}

export function Login({ onLogin, onSwitchToSignup, onBack }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConnectionTest, setShowConnectionTest] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    
    try {
      await onLogin(email, password);
    } catch (error: unknown) {
      // Show connection test option if there's a network error
      if (error instanceof Error && error.message.includes('fetch')) {
        setShowConnectionTest(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showConnectionTest) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-2xl">
          <Button 
            variant="outline" 
            onClick={() => setShowConnectionTest(false)}
            className="mb-4"
          >
            ? Back to Login
          </Button>
          <ConnectionTest />
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        {onBack && (
          <button
            onClick={onBack}
            className="group mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Portal Selection
          </button>
        )}
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <p className="text-muted-foreground mt-2">Faculty Portal</p>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Welcome Back!</CardTitle>
            <CardDescription className="text-center">
              Sign in to manage your students and classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="dr.name@dentalcollege.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary-foreground" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={onSwitchToSignup}
                  className="font-medium text-primary hover:underline"
                  disabled={isLoading}
                >
                  Sign up here
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
