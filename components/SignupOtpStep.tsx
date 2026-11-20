"use client";

import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp";
import { Label } from "./ui/label";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface SignupOtpStepProps {
  email: string;
  onVerify: (otp: string) => Promise<void> | void;
  onResend: () => Promise<void> | void;
  onChangeEmail: () => void;
}

const RESEND_SECONDS = 60;

export function SignupOtpStep({ email, onVerify, onResend, onChangeEmail }: SignupOtpStepProps) {
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the six-digit code from your email");
      return;
    }
    setIsVerifying(true);
    try {
      await onVerify(otp);
    } catch (error) {
      console.error("Verification failed:", error);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await onResend();
      setOtp("");
      setSecondsLeft(RESEND_SECONDS);
      toast.success("A new verification code is on its way");
    } catch (error) {
      console.error("Resend failed:", error);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="mobile-ui auth-screen flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="auth-heading mb-8 text-center">
          <div className="auth-heading-icon mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the six-digit code sent to <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>

        <div className="auth-panel rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="signup-otp" className="flex items-center gap-2">
                <Mail className="w-4 h-4" aria-hidden="true" />
                Verification code
              </Label>
              <InputOTP
                id="signup-otp"
                maxLength={6}
                value={otp}
                onChange={setOtp}
                disabled={isVerifying}
                autoFocus
              >
                <InputOTPGroup className="w-full justify-between">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} className="h-12 flex-1 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-muted-foreground">The code expires in 10 minutes.</p>
            </div>

            <Button type="submit" className="h-11 w-full" disabled={isVerifying || otp.length !== 6}>
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Verifying...
                </>
              ) : (
                "Verify and create account"
              )}
            </Button>
          </form>

          <div className="mt-5 space-y-3 text-center text-sm">
            {secondsLeft > 0 ? (
              <p className="text-muted-foreground">
                Didn&apos;t get a code? You can resend in {secondsLeft}s.
              </p>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={handleResend} disabled={isResending}>
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending...
                  </>
                ) : (
                  "Resend code"
                )}
              </Button>
            )}
            <Button type="button" variant="ghost" className="w-full" onClick={onChangeEmail} disabled={isVerifying || isResending}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Use a different email
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}