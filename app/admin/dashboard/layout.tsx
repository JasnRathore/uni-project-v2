'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  Database,
  GraduationCap,
  Home,
  ListTodo,
  LogOut,
  School,
  Settings as SettingsIcon,
  UserPlus,
  Users,
} from 'lucide-react';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DASHBOARD_LOGOUT_EVENT } from '@/lib/dashboard-events';
import { supabase } from '@/components/utils/supabase/client';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'portal-students', label: 'Portal Students', icon: UserPlus },
  { id: 'classes', label: 'Classes', icon: School },
  { id: 'tasks-quizzes', label: 'Tasks & Quizzes', icon: ListTodo },
  { id: 'marks', label: 'Marks Management', icon: BookOpen },
  { id: 'add-class', label: 'Add Class', icon: GraduationCap },
  { id: 'debug', label: 'Debug Panel', icon: Database },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const titles: Record<string, string> = {
  dashboard: 'Dashboard',
  students: 'Students',
  'portal-students': 'Portal Students',
  classes: 'Classes',
  'class-view': 'Class Details',
  'add-student': 'Add Student',
  'add-class': 'Add Class',
  'add-task': 'Add Daily Task',
  'add-quiz': 'Add Quiz',
  profile: 'Student Profile',
  'assign-student': 'Assign Student',
  marks: 'Marks Management',
  'tasks-quizzes': 'Tasks & Quizzes',
  'edit-task': 'Edit Task',
  settings: 'Settings',
  debug: 'Debug Panel',
};

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('Admin Portal');
  const activeView = pathname.slice('/admin/dashboard'.length).split('/').filter(Boolean)[0] || 'dashboard';

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        const name = data.session?.user?.user_metadata?.name;
        if (name) setDisplayName(`Dr. ${name}`);
      }
    }).catch(error => {
      console.error('Failed to load admin name:', error);
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
              <div className="p-2 bg-primary rounded-lg">
                <GraduationCap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">Dental College Portal</h2>
                <p className="text-sm text-muted-foreground">{displayName}</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => router.push(item.id === 'dashboard' ? '/admin/dashboard' : `/admin/dashboard/${item.id}`)}
                    isActive={activeView === item.id}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} className="text-destructive">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
          <header className="border-b bg-white/80 backdrop-blur-sm p-4 flex items-center gap-2 shadow-sm">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {titles[activeView] || 'Dashboard'}
            </h1>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
