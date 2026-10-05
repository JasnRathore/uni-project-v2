'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  GraduationCap,
  Home,
  ListTodo,
  LogOut,
  Trophy,
  User,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { DASHBOARD_LOGOUT_EVENT } from '@/lib/dashboard-events';
import { supabase } from '@/components/utils/supabase/client';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'grades', label: 'My Grades', icon: BookOpen },
  { id: 'tasks', label: 'Tasks & Quizzes', icon: ListTodo },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'profile', label: 'My Profile', icon: User },
];

const titles: Record<string, string> = {
  dashboard: 'Dashboard',
  grades: 'My Grades',
  tasks: 'Tasks & Quizzes',
  leaderboard: 'Leaderboard',
  profile: 'My Profile',
};

export default function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [studentName, setStudentName] = useState('Dental College');
  const activeView = pathname.slice('/student/dashboard'.length).split('/').filter(Boolean)[0] || 'dashboard';

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        const name = data.session?.user?.user_metadata?.name;
        if (name) setStudentName(name);
      }
    }).catch(error => {
      console.error('Failed to load student name:', error);
    });
    return () => { active = false; };
  }, []);

  const logout = () => {
    window.dispatchEvent(new Event(DASHBOARD_LOGOUT_EVENT));
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-svh">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-3 px-3 py-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap aria-hidden="true" className="size-5" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-semibold">Student portal</p>
                <p className="truncate text-xs text-muted-foreground">{studentName}</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Learning</SidebarGroupLabel>
              <SidebarMenu>
                {menuItems.map(item => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => router.push(item.id === 'dashboard' ? '/student/dashboard' : `/student/dashboard/${item.id}`)}
                      isActive={activeView === item.id}
                      tooltip={item.label}
                      aria-current={activeView === item.id ? 'page' : undefined}
                    >
                      <item.icon aria-hidden="true" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} tooltip="Logout">
                  <LogOut aria-hidden="true" />
                  <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="hidden min-h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:flex">
            <SidebarTrigger />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">
                {titles[activeView] || 'Dashboard'}
              </h1>
              <p className="text-xs text-muted-foreground">Learning workspace</p>
            </div>
            <span className="ml-auto max-w-48 truncate text-sm text-muted-foreground">
              {studentName}
            </span>
          </header>
          <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
