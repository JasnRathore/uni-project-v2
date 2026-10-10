"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, GraduationCap, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function PortalLanding() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-12 sm:py-16">
      <div className="w-full max-w-5xl">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <PortalLink
            href="/faculty/login"
            icon={<Users aria-hidden="true" className="size-5" />}
            title="Faculty portal"
            description="Manage classes, student records, grades, and assignments."
            action="Open the faculty portal"
          />
          <PortalLink
            href="/student/login"
            icon={<GraduationCap aria-hidden="true" className="size-5" />}
            title="Student"
            description="View grades, assigned work, notifications, and learning progress."
            action="Open the student portal"
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
  description: string;
  action: string;
};

function PortalLink({ href, icon, title, description, action }: PortalLinkProps) {
  return (
    <Link
      href={href}
      className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full border-border/80 shadow-sm transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
        <CardHeader className="pb-4">
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
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
