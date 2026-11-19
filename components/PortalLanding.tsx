"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, GraduationCap, House } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function PortalLanding() {
  return (
    <main className="mobile-ui portal-screen flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-12 sm:py-16">
      <div className="w-full max-w-5xl">
        <header className="portal-heading mb-8 text-center">
          <House aria-hidden="true" className="mx-auto mb-6 size-8 text-primary" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Portal Selection</h1>
        </header>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <PortalLink
            href="/student/login"
            icon={<GraduationCap aria-hidden="true" className="size-7" />}
            title="Student Portal"
            description={<><span className="portal-description-desktop">View grades, assigned work, notifications, and learning progress.</span><span className="portal-description-mobile hidden">Manage classes, student records, grades, and assignments.</span></>}
            action="Open the Student Portal"
          />
          <PortalLink
            href="/faculty/login"
            icon={<GraduationCap aria-hidden="true" className="size-7" />}
            title="Faculty Portal"
            description={<><span className="portal-description-desktop">Faculty portal for managing classes, student records, grades, and assignments.</span><span className="portal-description-mobile hidden">View grades, assigned work, notifications, and learning progress.</span></>}
            action="Open the Faculty Portal"
          />
        </div>
      </div>
    </main>
  );
}

type PortalLinkProps = {
  href: string;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action: string;
};

function PortalLink({ href, icon, title, description, action }: PortalLinkProps) {
  return (
    <Link
      href={href}
      className="portal-card-link group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="portal-card h-full border-border/80 shadow-sm transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
        <CardHeader className="items-center pb-5 text-center">
          <div className="portal-card-icon mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between border-t pt-4 text-sm font-medium text-primary">
            <span>{action}</span>
            <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
