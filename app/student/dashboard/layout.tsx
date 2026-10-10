'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  BookOpen,
  Home,
  ListTodo,
  Trophy,
  User,
} from 'lucide-react';
import { DashboardAccountMenu } from '@/components/DashboardAccountMenu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DASHBOARD_LOGOUT_EVENT } from '@/lib/dashboard-events';
import { supabase } from '@/components/utils/supabase/client';

interface StudentNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const menuGroups = [
  {
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    ],
  },
  {
    label: 'Learning',
    items: [
      { id: 'grades', label: 'My Grades', icon: BookOpen },
      { id: 'tasks', label: 'Tasks & Quizzes', icon: ListTodo },
    ],
  },
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
  const [studentEmail, setStudentEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const activeView = pathname.slice('/student/dashboard'.length).split('/').filter(Boolean)[0] || 'dashboard';

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        const user = data.session?.user;
        const name = user?.user_metadata?.name;
        if (name) setStudentName(name);
        if (user?.email) setStudentEmail(user.email);
        if (user?.id) setStudentId(user.id);
        if (data.session?.access_token) setAccessToken(data.session.access_token);
      }
    }).catch(error => {
      console.error('Failed to load student name:', error);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    const controller = new AbortController();
    const loadNotifications = async () => {
      try {
        const response = await fetch('/api/student/notifications', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load notifications (${response.status})`);
        }
        const data = await response.json();
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Failed to load student notifications:', error);
      }
    };

    void loadNotifications();
    return () => controller.abort();
  }, [accessToken]);

  const unreadCount = notifications.filter(notification => !notification.read).length;

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/student/notifications/read', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to mark notification read (${response.status})`);
      }
      setNotifications(previous => previous.map(notification => (
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )));
    } catch (error) {
      console.error('Failed to mark student notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleNotificationClick = (notification: StudentNotification) => {
    if (notification.type === 'task') router.push('/student/dashboard/tasks');
    if (notification.type === 'grade') router.push('/student/dashboard/grades');
    setShowNotifications(false);
    if (!notification.read) void markNotificationAsRead(notification.id);
  };

  const logout = () => {
    window.dispatchEvent(new Event(DASHBOARD_LOGOUT_EVENT));
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full min-w-0 flex-1">
        <Sidebar collapsible="icon">
          <SidebarContent>
            {menuGroups.map(group => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map(item => (
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
            ))}
            <SidebarGroup>
              <SidebarGroupLabel>Updates</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    onClick={() => setShowNotifications(true)}
                    tooltip={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                    aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                  >
                    <span className="relative">
                      <Bell aria-hidden="true" />
                      {unreadCount > 0 && (
                        <span
                          aria-hidden="true"
                          className="absolute -right-1 -top-1 hidden size-2 rounded-full bg-destructive group-data-[collapsible=icon]:block"
                        />
                      )}
                    </span>
                    <span className="group-data-[collapsible=icon]:hidden">Notifications</span>
                    {unreadCount > 0 && (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground">
                        {unreadCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="mt-auto border-t border-sidebar-border pt-3">
            <DashboardAccountMenu
              role="student"
              displayName={studentName}
              email={studentEmail}
              identifier={studentId || studentEmail}
              links={[
                { label: 'My profile', href: '/student/dashboard/profile', icon: User },
              ]}
              onNavigate={path => router.push(path)}
              onLogout={logout}
            />
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="sticky top-0 z-10 hidden min-h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:flex">
            <SidebarTrigger />
            <h1 className="min-w-0 truncate text-sm font-semibold">
              {titles[activeView] || 'Dashboard'}
            </h1>
          </header>
          <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="border-b p-5">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bell aria-hidden="true" className="size-4" />
              Notifications
            </DialogTitle>
            <DialogDescription>
              {unreadCount === 0
                ? 'You are all caught up.'
                : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length > 0 ? (
              <ul className="divide-y">
                {notifications.map(notification => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={`w-full px-5 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                        !notification.read ? 'bg-muted/40' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <Badge variant={notification.read ? 'outline' : 'secondary'}>
                          {notification.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h5 className="text-sm font-medium">{notification.title}</h5>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {notification.message}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center">
                <Bell aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No notifications</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  New messages will appear here.
                </p>
              </div>
            )}
          </div>
          <div className="border-t p-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowNotifications(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
