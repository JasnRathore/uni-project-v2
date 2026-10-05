"use client";
import { PortalLanding } from "../components/PortalLanding";
import { Toaster } from "../components/ui/sonner";

export default function Home() {
  return (
    <>
      <PortalLanding />
      <Toaster />
    </>
  );
}
