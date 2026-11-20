"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("We could not process your request. Please try again.");
      // The API responds generically whether or not the email exists.
      setSent(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mobile-ui auth-screen flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="auth-back-button group mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="auth-back-label">Back to Portal Selection</span>
        </Link>

        <div className="auth-heading mb-8 text-center">
          <div className="auth-heading-icon mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="size-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Forgot Password</h1>
        </div>

        <Card className="auth-panel border-border/80 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Reset your password</CardTitle>
            <CardDescription className="text-center">
              Enter your email and we&apos;ll send you a link to choose a new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div role="status" aria-live="polite" className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>, a password
                  reset link is on its way. The link expires in about an hour.
                </p>
                <Link
                  href="/"
                  className={buttonVariants({ variant: "outline", className: "w-full" })}
                >
                  Back to Portal Selection
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="auth-field-label">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="auth-input-icon absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@dentalcollege.edu"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                {errorMessage && (
                  <p role="alert" className="text-sm text-destructive">
                    {errorMessage}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary-foreground" />
                      Sending...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
