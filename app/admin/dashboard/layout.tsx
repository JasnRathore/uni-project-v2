'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  BookOpen,
  Database,
  Home,
  ListTodo,
  LogOut,
  Moon,
  School,
  Settings as SettingsIcon,
  Sun,
  Monitor,
  Users,
  ChevronsUpDown,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
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
import { DASHBOARD_LOGOUT_EVENT } from '@/lib/dashboard-events';
import { supabase } from '@/components/utils/supabase/client';

const menuItems = [
  {
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Overview', icon: Home },
      { id: 'students', label: 'Students', icon: Users },
      { id: 'classes', label: 'Classes', icon: School },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { id: 'tasks-quizzes', label: 'Tasks & quizzes', icon: ListTodo },
      { id: 'grades', label: 'Grades', icon: BookOpen },
    ],
  },
];

const titles: Record<string, string> = {
  dashboard: 'Dashboard',
  students: 'Students',
  'portal-students': 'Students',
  classes: 'Classes',
  grades: 'Grades',
  marks: 'Grades',
  'class-view': 'Class Details',
  'add-student': 'Add Student',
  'add-task': 'Add Daily Task',
  'add-quiz': 'Add Quiz',
  profile: 'Student Profile',
  'assign-student': 'Assign Student',
  'tasks-quizzes': 'Tasks & Quizzes',
  'edit-task': 'Edit Task',
  settings: 'Settings',
  debug: 'Debug Panel',
};

function AccountMenu({
  displayName,
  email,
  identifier,
  onNavigate,
  onLogout,
}: {
  displayName: string;
  email: string;
  identifier: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
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
            <RoleAvatar role="professor" identifier={identifier} name={displayName} />
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
                  <RoleAvatar role="professor" identifier={identifier} name={displayName} />
                  <span className="grid min-w-0 text-left text-sm leading-tight">
                    <span className="truncate font-medium text-foreground">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate('/admin/dashboard/settings')}>
              <SettingsIcon aria-hidden="true" />
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate('/admin/dashboard/debug')}>
              <Database aria-hidden="true" />
              Diagnostics
            </DropdownMenuItem>
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

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('Administrator');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [pageTitle, setPageTitle] = useState('Overview');
  const activeView = pathname.slice('/admin/dashboard'.length).split('/').filter(Boolean)[0] || 'dashboard';
  const isItemActive = (itemId: string) => activeView === itemId
    || (itemId === 'students' && activeView === 'portal-students')
    || (itemId === 'grades' && activeView === 'marks');

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        const user = data.session?.user;
        const name = user?.user_metadata?.name || user?.user_metadata?.full_name;
        if (name) setDisplayName(name);
        if (user?.email) setEmail(user.email);
        if (user?.id) setIdentifier(user.id);
      }
    }).catch(error => {
      console.error('Failed to load admin name:', error);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleTitleChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) setPageTitle(detail);
    };
    window.addEventListener('dashboard-title-change', handleTitleChange);
    return () => window.removeEventListener('dashboard-title-change', handleTitleChange);
  }, [activeView]);

  const logout = () => {
    window.dispatchEvent(new Event(DASHBOARD_LOGOUT_EVENT));
  };

  return (
    <SidebarProvider>
        <div className="flex min-h-svh w-full min-w-0 flex-1">
          <Sidebar collapsible="icon">
            <SidebarContent>
              {menuItems.map(group => (
                <SidebarGroup key={group.label}>
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarMenu>
                    {group.items.map(item => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          onClick={() => router.push(item.id === 'dashboard' ? '/admin/dashboard' : `/admin/dashboard/${item.id}`)}
                          isActive={isItemActive(item.id)}
                          tooltip={item.label}
                          aria-current={isItemActive(item.id) ? 'page' : undefined}
                        >
                          <item.icon aria-hidden="true" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              ))}
            </SidebarContent>
            <SidebarFooter className="mt-auto border-t border-sidebar-border pt-3">
              <AccountMenu
                displayName={displayName}
                email={email}
                identifier={identifier || email}
                onNavigate={path => router.push(path)}
                onLogout={logout}
              />
            </SidebarFooter>
          </Sidebar>
          <div className="flex min-w-0 flex-1 flex-col bg-background">
            <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <SidebarTrigger />
              <h1 className="truncate text-sm font-semibold">
                {activeView === 'class-view' ? pageTitle : (titles[activeView] || 'Overview')}
              </h1>
            </header>
            <main id="main-content" className="min-h-0 flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>
    </SidebarProvider>
  );
}
