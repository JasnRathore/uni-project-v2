"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Mail, Lock, Eye, EyeOff, User, BookOpen, CalendarDays, GraduationCap, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export interface SignupCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  departmentId: string;
  qualification: string;
}

interface Department {
  id: string;
  name: string;
}

interface SignupProps {
  onSignup: (credentials: SignupCredentials) => void | Promise<void>;
  onSwitchToLogin: () => void;
  onBack: () => void;
}

export function Signup({ onSignup, onSwitchToLogin, onBack }: SignupProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    departmentId: '',
    qualification: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await fetch('/api/academic/departments');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load departments');
        setDepartments(data.departments);
      } catch (error) {
        console.error('Department lookup failed:', error);
        toast.error('Could not load departments. Please refresh and try again.');
      } finally {
        setDepartmentsLoading(false);
      }
    };
    void loadDepartments();
  }, []);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password || !formData.departmentId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      await onSignup(formData);
    } catch (error) {
      console.error('Signup error:', error);
      setIsLoading(false);
    }
  };

  return (
    <main className="mobile-ui auth-screen flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="auth-back-button group mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back to portal selection"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="auth-back-label">Back to Portal Selection</span>
          </button>
        )}
        <div className="auth-heading text-center mb-8">
          <div className="auth-heading-icon mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="size-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Faculty Portal
          </h1>
          <p className="text-muted-foreground mt-2">Create your account to get started</p>
        </div>

        <Card className="auth-panel border-border/80 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              Join your dental college portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="auth-field-label">
                  <span className="auth-mobile-label-icon hidden"><User aria-hidden="true" /></span>
                  Full Name *
                </Label>
                <div className="relative">
                  <User className="auth-input-icon absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Dr. Your Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="auth-field-label">
                  <span className="auth-mobile-label-icon hidden"><Mail aria-hidden="true" /></span>
                  Email Address *
                </Label>
                <div className="relative">
                  <Mail className="auth-input-icon absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="dr.name@dentalcollege.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department" className="auth-field-label">
                  <span className="auth-mobile-label-icon hidden"><CalendarDays aria-hidden="true" /></span>
                  Department *
                </Label>
                <Select 
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value ?? '' })}
                  disabled={isLoading || departmentsLoading}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select your department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(department => (
                      <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qualification" className="auth-field-label">
                  <span className="auth-mobile-label-icon hidden"><BookOpen aria-hidden="true" /></span>
                  Qualification
                </Label>
                <div className="relative">
                  <BookOpen className="auth-input-icon absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="qualification"
                    type="text"
                    placeholder="e.g., BDS, MDS"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="auth-field-label">
                  <span className="auth-mobile-label-icon hidden"><Lock aria-hidden="true" /></span>
                  Password *
                </Label>
                <div className="relative">
                  <Lock className="auth-input-icon absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="auth-field-label">
                  <span className="auth-mobile-label-icon hidden"><Lock aria-hidden="true" /></span>
                  Confirm Password *
                </Label>
                <div className="relative">
                  <Lock className="auth-input-icon absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">Already have an account?</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onSwitchToLogin}
                className="h-11 w-full"
                disabled={isLoading}
              >
                <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
