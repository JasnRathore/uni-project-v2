'use client';

import {
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { RoleAvatar } from '@/components/RoleAvatar';
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
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface DashboardAccountMenuProps {
  role: 'professor' | 'student';
  displayName: string;
  email: string;
  identifier: string;
  links: Array<{ label: string; href: string; icon: LucideIcon }>;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export function DashboardAccountMenu({
  role,
  displayName,
  email,
  identifier,
  links,
  onNavigate,
  onLogout,
}: DashboardAccountMenuProps) {
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label="Account menu"
                title="Account menu"
                className="aria-expanded:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
              />
            }
          >
            <RoleAvatar role={role} identifier={identifier} name={displayName} />
            <span className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="ml-auto group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64"
            side={isMobile ? 'bottom' : 'top'}
            align="start"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <span className="flex items-center gap-3 px-2 py-2">
                  <RoleAvatar role={role} identifier={identifier} name={displayName} />
                  <span className="grid min-w-0 text-left text-sm leading-tight">
                    <span className="truncate font-medium text-foreground">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {links.map(({ label, href, icon: Icon }) => (
              <DropdownMenuItem key={href} onClick={() => onNavigate(href)}>
                <Icon aria-hidden="true" />
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Sun aria-hidden="true" />
                Appearance
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={theme || 'light'}
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

