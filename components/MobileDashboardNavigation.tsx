"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RoleAvatar } from "@/components/RoleAvatar";
import type { LucideIcon } from "lucide-react";
import { LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";

interface MobileNavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  activeRoutes?: string[];
}

interface MobileDashboardNavigationProps {
  role: "professor" | "student";
  title: string;
  displayName: string;
  email: string;
  identifier: string;
  accountLabel: string;
  accountHref: string;
  onLogout: () => void;
  items: MobileNavigationItem[];
  rightAction?: ReactNode;
}

export function MobileDashboardNavigation({
  role,
  title,
  displayName,
  email,
  identifier,
  accountLabel,
  accountHref,
  onLogout,
  items,
  rightAction,
}: MobileDashboardNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <header className="mobile-dashboard-header">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mobile-header-button mobile-account-button"
                aria-label="Open account menu"
              />
            }
          >
            <UserRound aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-3 font-normal">
                <RoleAvatar
                  role={role}
                  identifier={identifier}
                  name={displayName}
                  className="size-9"
                />
                <span className="grid min-w-0">
                  <span className="truncate text-sm font-medium">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(accountHref)}>
              <UserRound aria-hidden="true" />
              {accountLabel}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Sun aria-hidden="true" />
                Appearance
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={theme || "light"}
                  onValueChange={setTheme}
                >
                  <DropdownMenuRadioItem value="light">
                    <Sun aria-hidden="true" />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon aria-hidden="true" />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor aria-hidden="true" />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onLogout}>
              <LogOut aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <h1 className="mobile-dashboard-title">{title}</h1>
        <div className="mobile-header-action">{rightAction}</div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        {items.map(({ label, href, icon: Icon, activeRoutes = [] }) => {
          const isActive = [href, ...activeRoutes].some(
            (route) => pathname === route || pathname.startsWith(`${route}/`),
          );

          return (
            <Link
              key={href}
              href={href}
              className="mobile-bottom-nav-link"
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              title={label}
            >
              <Icon aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
