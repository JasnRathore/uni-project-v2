'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  Home,
  ListTodo,
  LogOut,
  Trophy,
  User,
} from 'lucide-react';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
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
      <div className="flex h-screen">
        <Sidebar>
          <SidebarHeader>
            <div className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <Home className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-semibold">Student Portal</h2>
                <p className="text-sm text-muted-foreground">{studentName}</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => router.push(item.id === 'dashboard' ? '/student/dashboard' : `/student/dashboard/${item.id}`)}
                    isActive={activeView === item.id}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={logout}>
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <div className="flex-1 min-w-0 flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <header className="hidden lg:flex border-b bg-white/80 backdrop-blur-sm p-4 items-center gap-2 shadow-sm">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {titles[activeView] || 'Dashboard'}
            </h1>
          </header>
          <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
