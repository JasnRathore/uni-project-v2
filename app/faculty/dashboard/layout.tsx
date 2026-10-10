'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  Database,
  Home,
  ListTodo,
  Settings as SettingsIcon,
  School,
  Users,
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
} from '@/components/ui/sidebar';
import { DASHBOARD_LOGOUT_EVENT } from '@/lib/dashboard-events';
import { supabase } from '@/components/utils/supabase/client';
import { DashboardAccountMenu } from '@/components/DashboardAccountMenu';

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
  'add-task': 'Add Daily Task',
  'add-quiz': 'Add Quiz',
  profile: 'Student Profile',
  'student-details': 'Student Details',
  'tasks-quizzes': 'Tasks & Quizzes',
  'edit-task': 'Edit Task',
  settings: 'Settings',
  debug: 'Debug Panel',
  catalog: 'Academic Catalog',
};

export default function FacultyDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('Faculty');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [canManageCatalog, setCanManageCatalog] = useState(false);
  const [pageTitle, setPageTitle] = useState('Overview');
  const activeView = pathname.slice('/faculty/dashboard'.length).split('/').filter(Boolean)[0] || 'dashboard';
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
        setCanManageCatalog(['admin', 'administrator'].includes(user?.user_metadata?.role));
        if (user?.email) setEmail(user.email);
        if (user?.id) setIdentifier(user.id);
      }
    }).catch(error => {
      console.error('Failed to load faculty name:', error);
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
  const visibleMenuItems = canManageCatalog
    ? [...menuItems, { label: 'Academic', items: [{ id: 'catalog', label: 'Academic catalog', icon: BookOpen }] }]
    : menuItems;

  return (
    <SidebarProvider>
        <div className="flex min-h-svh w-full min-w-0 flex-1">
          <Sidebar collapsible="icon">
            <SidebarContent>
              {visibleMenuItems.map(group => (
                <SidebarGroup key={group.label}>
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarMenu>
                    {group.items.map(item => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          onClick={() => router.push(item.id === 'dashboard' ? '/faculty/dashboard' : `/faculty/dashboard/${item.id}`)}
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
              <DashboardAccountMenu
                role="professor"
                displayName={displayName}
                email={email}
                identifier={identifier || email}
                links={[
                  { label: 'Account settings', href: '/faculty/dashboard/settings', icon: SettingsIcon },
                  { label: 'Diagnostics', href: '/faculty/dashboard/debug', icon: Database },
                ]}
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
