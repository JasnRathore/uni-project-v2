"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { GraduationCap, Mail, Lock, User, ArrowLeft, UserPlus, Hash, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSpinner } from './ui/loading';

interface StudentSignupProps {
  onSignup: (credentials: StudentSignupCredentials) => void | Promise<void>;
  onSwitchToLogin: () => void;
  onBack: () => void;
}

interface StudentSignupCredentials {
  name: string;
  username: string;
  email: string;
  prn: string;
  degreeId: string;
  cohortId: string;
  password: string;
}

interface DegreeOption {
  id: string;
  name: string;
}

interface CohortOption {
  id: string;
  label: string;
}

export function StudentSignup({ onSignup, onSwitchToLogin, onBack }: StudentSignupProps) {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    prn: '',
    degreeId: '',
    cohortId: '',
    password: '',
    confirmPassword: ''
  });
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/academic/degrees', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Unable to load degrees');
        setDegrees(Array.isArray(data.degrees) ? data.degrees : []);
      })
      .catch(error => {
        console.error('Failed to load degrees:', error);
        toast.error('Unable to load degree options');
      });
  }, []);

  useEffect(() => {
    if (!formData.degreeId) {
      setCohorts([]);
      return;
    }
    fetch(`/api/academic/degrees/${encodeURIComponent(formData.degreeId)}/cohorts`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Unable to load cohorts');
        setCohorts(Array.isArray(data.cohorts) ? data.cohorts : []);
      })
      .catch(error => {
        console.error('Failed to load cohorts:', error);
        setCohorts([]);
        toast.error('Unable to load graduation cohorts');
      });
  }, [formData.degreeId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    if (!formData.username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    if (!formData.email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    if (!formData.prn.trim()) {
      toast.error('Please enter your PRN');
      return;
    }

    if (!formData.degreeId) {
      toast.error('Please select your degree');
      return;
    }

    if (!formData.cohortId) {
      toast.error('Please select your graduation cohort');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await onSignup({
        name: formData.name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        prn: formData.prn.trim(),
        degreeId: formData.degreeId,
        cohortId: formData.cohortId,
        password: formData.password
      });
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="size-7" />
          </div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-foreground">Student Portal</h1>
          <p className="text-muted-foreground">Create your account to get started</p>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              Join your dental college portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe123"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@school.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prn" className="flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  PRN
                </Label>
                <Input
                  id="prn"
                  type="text"
                  placeholder="Enter your PRN"
                  value={formData.prn}
                  onChange={(e) => setFormData({...formData, prn: e.target.value})}
                  required
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="degreeId" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Degree
                  </Label>
                  <Select
                    value={formData.degreeId}
                    onValueChange={(value) => setFormData({...formData, degreeId: value ?? '', cohortId: ''})}
                  >
                    <SelectTrigger id="degreeId" className="h-11">
                      <SelectValue placeholder="Degree" />
                    </SelectTrigger>
                    <SelectContent>
                      {degrees.map((degree) => (
                        <SelectItem key={degree.id} value={degree.id}>{degree.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cohortId" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Graduation Cohort
                  </Label>
                  <Select
                    value={formData.cohortId}
                    onValueChange={(value) => setFormData({...formData, cohortId: value ?? ''})}
                    disabled={!formData.degreeId || cohorts.length === 0}
                  >
                    <SelectTrigger id="cohortId" className="h-11">
                      <SelectValue placeholder="Graduation cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map((cohort) => (
                        <SelectItem key={cohort.id} value={cohort.id}>{cohort.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  required
                  className="h-11"
                />
              </div>
              
              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner className="size-4 text-primary-foreground" />
                    Creating account...
                  </div>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Already have an account?
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={onSwitchToLogin}
                className="w-full h-11 mt-3"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
