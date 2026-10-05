"use client";
import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarTrigger } from "./ui/sidebar";
import {
  Card,
  CardContent,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { RoleAvatar } from "./RoleAvatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Alert, AlertDescription } from "./ui/alert";
import { TakeQuiz } from "./TakeQuiz";
import { StudentProfile } from "./StudentProfile";
import { StudentLeaderboard } from "./StudentLeaderboard";
import {
  Trophy,
  Star,
  Bell,
  Zap,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface StudentDashboardProps {
  student: any;
  accessToken: string;
  projectId: string;
}

export function StudentDashboard({
  student,
  accessToken,
  projectId,
}: StudentDashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [grades, setGrades] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const activeView = pathname.split("/").filter(Boolean).at(-1) || "dashboard";
  const setActiveView = (view: string) => {
    router.push(view === "dashboard" ? "/student/dashboard" : `/student/dashboard/${view}`);
  };
  const [dailyQuest, setDailyQuest] = useState<any>(null);
  const [showDailyQuestDialog, setShowDailyQuestDialog] = useState(false);
  const [adminMessage, setAdminMessage] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileData = {
    name: student?.name || "",
    email: student?.email || "",
    username: student?.username || "",
    rollNumber: student?.rollNumber || "",
    batch: student?.batch || "",
    class: "",
    phone: "",
    department: "",
    semester: "",
  };
  const [stats, setStats] = useState({
    totalEXP: 0,
    level: 1,
    currentLevelEXP: 0,
    nextLevelEXP: 100,
    streak: 0,
    totalAssignments: 0,
    completedAssignments: 0,
  });

  useEffect(() => {
    loadStudentData();
    checkDailyQuest();
    loadNotifications();
  }, []);

  const loadStudentData = async () => {
    try {
      const response = await fetch(`/api/student/data`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Student data loaded:", data);
        setGrades(data.grades || []);
        setTasks(data.tasks || []);
        setAdminMessage(data.adminMessage || null);
        calculateStats(
          data.grades || [],
          data.tasks || [],
          data.streakData || { currentStreak: 0, longestStreak: 0 },
        );
      }
    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Failed to load data");
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await fetch(
        `/api/student/notifications`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Notifications loaded:", data.notifications);
        setNotifications(data.notifications || []);
        const unread = (data.notifications || []).filter((n) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const checkDailyQuest = async () => {
    try {
      const response = await fetch(`/api/quest`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Daily quest data:", data);
        if (data.quest) {
          setDailyQuest(data.quest);
        }
      }
    } catch (error) {
      console.error("Error checking daily quest:", error);
    }
  };

  const calculateStats = (gradesData, tasksData, streakData) => {
    // Calculate total EXP from grades
    const totalEXP = gradesData.reduce((sum, grade) => {
      if (grade.score != null && grade.maxScore != null && grade.maxScore > 0) {
        const percentage = (grade.score / grade.maxScore) * 100;
        const baseExp = Math.floor(percentage);
        let bonus = 0;
        if (percentage >= 95) bonus = 15;
        else if (percentage >= 90) bonus = 10;
        else if (percentage >= 80) bonus = 5;
        return sum + baseExp + bonus;
      }
      if (grade.grade) {
        const gradeMap = {
          "A+": 100,
          A: 95,
          "A-": 90,
          "B+": 85,
          B: 80,
          "B-": 75,
          "C+": 70,
          C: 65,
          "C-": 60,
          D: 50,
          F: 0,
        };
        return sum + (gradeMap[grade.grade] || 0);
      }
      return sum;
    }, 0);

    const level = Math.floor(totalEXP / 500) + 1;
    const currentLevelEXP = totalEXP % 500;
    const nextLevelEXP = 500;

    const completedAssignments = tasksData.filter((t: any) => {
      const isGraded = gradesData.some(
        (g) => g.taskId === t.id || g.task_id === t.id,
      );
      return t.completed === true || t.grade != null || isGraded;
    }).length;
    const totalAssignments = tasksData.length;

    setStats({
      totalEXP,
      level,
      currentLevelEXP,
      nextLevelEXP,
      streak: streakData?.currentStreak || 0,
      totalAssignments,
      completedAssignments,
    });
  };

  const handleQuizSubmission = async (submission: any) => {
    try {
      const response = await fetch(
        `/api/student/quiz/submit`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(submission),
        },
      );

      if (response.ok) {
        toast.success("Quiz submitted successfully!");
        setSelectedQuiz(null);
        loadStudentData();
      } else {
        toast.error("Failed to submit quiz");
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast.error("Failed to submit quiz");
    }
  };

  const markNotificationAsRead = async (notificationId: any) => {
    try {
      const response = await fetch(`/api/student/notifications/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to mark notification read (${response.status})`);
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to mark notification as read");
    }
  };

  const startQuiz = (quiz: any) => {
    setSelectedQuiz(quiz);
  };

  const handleNotificationClick = (notif: any) => {
    if (notif.type === "task") {
      setActiveView("tasks");
    } else if (notif.type === "grade") {
      setActiveView("grades");
    }
  };

  const markDailyQuestSeen = () => {
    // Mark daily quest as seen in backend
  };

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  if (selectedQuiz) {
    return (
      <TakeQuiz
        quiz={selectedQuiz}
        onBack={() => setSelectedQuiz(null)}
        onSubmit={handleQuizSubmission}
      />
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const response = await fetch(
        `/api/student/profile/update`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profileData),
        },
      );

      if (response.ok) {
        toast.success("Profile updated successfully!");
        loadStudentData();
      } else {
        toast.error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error updating profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
  });

  const ongoingTasks = sortedTasks.filter((t: any) => {
    const isGraded = grades.some(
      (g) =>
        g.taskId === t.id || g.task_id === t.id || g.assignment === t.title,
    );
    return !t.completed && !isGraded;
  });

  const completedTasks = sortedTasks.filter((t: any) => {
    const isGraded = grades.some(
      (g) =>
        g.taskId === t.id || g.task_id === t.id || g.assignment === t.title,
    );
    return t.completed || isGraded;
  });

  return (
      <>
        {/* Mobile Header */}
        <div className="border-b bg-background px-4 py-2.5 lg:hidden">
          <div className="flex items-center justify-between">
            <SidebarTrigger
              size="icon-sm"
              aria-label="Open navigation menu"
            />
            <div className="flex items-center gap-2">
              <GraduationCap aria-hidden="true" className="size-5 text-primary" />
              <span className="text-sm font-semibold">Student portal</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowNotifications(true)}
                className="relative"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              >
                <Bell aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </Button>
              <RoleAvatar
                role="student"
                identifier={student?.id || student?.email}
                name={profileData.name}
                className="size-8"
                fallbackClassName="text-xs font-medium"
              />
            </div>
          </div>
        </div>

        <div className="w-full min-w-0">
              <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {/* Profile Content if active */}
                {activeView === "profile" && (
                  <StudentProfile
                    student={{ ...student, ...profileData }}
                    onBack={() => setActiveView("dashboard")}
                    accessToken={accessToken}
                    projectId={projectId}
                    onUpdate={loadStudentData}
                  />
                )}

                {/* Admin Broadcast Message - only show on dashboard */}
                {activeView === "dashboard" && adminMessage && (
                  <Alert className="mb-6">
                    <Info aria-hidden="true" />
                    <AlertDescription>
                      <span className="mb-1 block font-medium text-foreground">
                        Message from administration
                      </span>
                      {adminMessage}
                    </AlertDescription>
                  </Alert>
                )}

                {/* View Content based on activeView */}
                {activeView === "dashboard" && (
                  <div className="flex flex-col gap-8">
                    <section aria-labelledby="student-overview-heading">
                      <h2 id="student-overview-heading" className="text-2xl font-semibold tracking-tight">
                        Your learning overview
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Check your progress and see what needs attention.
                      </p>
                    </section>
                    {/* Stats Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Card className="shadow-none">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Level</p>
                              <p className="mt-2 text-3xl font-semibold tabular-nums">{stats.level}</p>
                            </div>
                            <Trophy aria-hidden="true" className="size-5 text-muted-foreground" />
                          </div>
                          <div className="mt-5">
                            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                              <span>Progress to level {stats.level + 1}</span>
                              <span>{Math.round((stats.currentLevelEXP / stats.nextLevelEXP) * 100)}%</span>
                            </div>
                            <Progress value={(stats.currentLevelEXP / stats.nextLevelEXP) * 100} />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-none">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Experience points</p>
                              <p className="mt-2 text-3xl font-semibold tabular-nums">{stats.totalEXP}</p>
                            </div>
                            <Star aria-hidden="true" className="size-5 text-muted-foreground" />
                          </div>
                          <p className="mt-5 text-xs text-muted-foreground">Earn points from graded work.</p>
                        </CardContent>
                      </Card>

                      <Card className="shadow-none">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Learning streak</p>
                              <p className="mt-2 text-3xl font-semibold tabular-nums">{stats.streak} <span className="text-base font-normal text-muted-foreground">days</span></p>
                            </div>
                            <Flame aria-hidden="true" className="size-5 text-muted-foreground" />
                          </div>
                          <p className="mt-5 text-xs text-muted-foreground">Keep a steady study routine.</p>
                        </CardContent>
                      </Card>

                      <Card className="shadow-none">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Tasks completed</p>
                              <p className="mt-2 text-3xl font-semibold tabular-nums">
                                {stats.completedAssignments}<span className="text-base font-normal text-muted-foreground"> / {stats.totalAssignments}</span>
                              </p>
                            </div>
                            <CheckCircle2 aria-hidden="true" className="size-5 text-muted-foreground" />
                          </div>
                          <div className="mt-5">
                            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                              <span>Completion</span>
                              <span>{stats.totalAssignments > 0 ? Math.round((stats.completedAssignments / stats.totalAssignments) * 100) : 0}%</span>
                            </div>
                            <Progress value={stats.totalAssignments > 0 ? (stats.completedAssignments / stats.totalAssignments) * 100 : 0} />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <section className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">Upcoming work</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {ongoingTasks.length
                              ? `${ongoingTasks.length} task${ongoingTasks.length === 1 ? '' : 's'} awaiting completion`
                              : 'You are up to date on assigned work.'}
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => setActiveView("tasks")}>
                          View all tasks
                        </Button>
                      </div>

                      {ongoingTasks.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          {ongoingTasks.slice(0, 4).map((task) => (
                            <Card key={task.id} className="shadow-none">
                              <CardContent className="flex h-full flex-col p-5">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <Badge variant="secondary">
                                    {task.type === "quiz" ? "QUIZ" : "TASK"}
                                  </Badge>
                                  {task.dueDate && (
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Clock aria-hidden="true" className="size-3.5" />
                                      Due {new Date(task.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-medium leading-6">
                                  {task.title}
                                </h4>
                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                  {task.description || "No description provided."}
                                </p>
                                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Zap aria-hidden="true" className="size-3.5" />
                                      {task.maxPoints || 100} XP
                                  </span>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      if (task.type === "quiz") startQuiz(task);
                                      else setActiveView("tasks");
                                    }}
                                  >
                                    {task.type === "quiz"
                                      ? "Start quiz"
                                      : "View task"}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Card className="shadow-none">
                          <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
                            <CheckCircle2 aria-hidden="true" className="size-5 text-muted-foreground" />
                            <div className="flex-1">
                              <h4 className="font-medium">No outstanding work</h4>
                              <p className="mt-1 text-sm text-muted-foreground">
                                New assignments and quizzes will appear here.
                              </p>
                            </div>
                            <Button variant="outline" onClick={() => setActiveView("grades")}>
                              Review grades
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </section>
                  </div>
                )}

                {activeView === "grades" && (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div className="rounded-lg border bg-card px-4 py-2">
                        <p className="text-xs text-muted-foreground">Average score</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {grades.length > 0
                            ? Math.round(
                                grades.reduce(
                                  (a, b) =>
                                    a +
                                    (typeof b.score === "number" ? b.score : 0),
                                  0,
                                ) / grades.length,
                              )
                            : 0}
                          %
                        </p>
                      </div>
                    </div>

                    <Card className="shadow-none">
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="border-b bg-muted/50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:px-6">
                                  Assignment
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:px-6">
                                  Subject
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:px-6">
                                  Date
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:px-6">
                                  Result
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {grades.map((grade, index) => (
                                  <tr
                                    key={grade.id || `${grade.assignment}-${grade.date}-${index}`}
                                    className="transition-colors hover:bg-muted/40"
                                  >
                                    <td className="max-w-64 px-4 py-4 sm:px-6">
                                      <span className="block truncate text-sm font-medium">
                                          {grade.assignment}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 sm:px-6">
                                      <Badge
                                        variant="outline"
                                      >
                                        {grade.subject}
                                      </Badge>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground sm:px-6">
                                      {new Date(
                                        grade.date,
                                      ).toLocaleDateString()}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-4 text-right">
                                      <div className="flex flex-col items-end gap-0.5">
                                        <span className="font-semibold tabular-nums">
                                          {grade.grade || "—"}
                                        </span>
                                        {typeof grade.score === "number" && (
                                          <span className="text-xs text-muted-foreground">
                                            {grade.score}%
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                              ))}
                              {grades.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={4}
                                    className="px-6 py-16 text-center"
                                  >
                                    <div className="mx-auto max-w-sm">
                                      <h4 className="font-medium">No grades yet</h4>
                                      <p className="mt-1 text-sm text-muted-foreground">
                                        Grades will appear here after your work has been reviewed.
                                      </p>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeView === "tasks" && (
                  <div className="flex flex-col gap-8">
                    {/* Task Categories */}
                    <div className="flex flex-col gap-8">
                      {/* Ongoing Section */}
                      <section className="flex flex-col gap-4">
                        <div>
                          <h3 className="font-semibold">Ongoing assignments</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {ongoingTasks.length} item{ongoingTasks.length === 1 ? '' : 's'}
                          </p>
                        </div>

                        {ongoingTasks.length > 0 ? (
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {ongoingTasks.map((task) => (
                            <Card key={task.id} className="shadow-none">
                              <CardContent className="flex h-full flex-col p-5">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                  <Badge variant="secondary">
                                    {task.type || "Task"}
                                  </Badge>
                                  <Badge variant="outline">Priority: {task.priority || "Medium"}</Badge>
                                </div>

                                <h4 className="font-medium leading-6">
                                  {task.title}
                                </h4>
                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                  {task.description ||
                                    "No additional details provided."}
                                </p>

                                <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4">
                                  <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">Subject</p>
                                    <p className="truncate text-sm font-medium">
                                      {task.subject}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Due date</p>
                                    <p className="text-sm font-medium">
                                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Not set"}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                                  <span className="text-sm text-muted-foreground">{task.maxPoints || 100} XP</span>
                                  {task.type === "quiz" && (
                                    <Button
                                      onClick={() => startQuiz(task)}
                                    >
                                      Start quiz
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                            ))}
                          </div>
                        ) : (
                          <Card className="shadow-none">
                            <CardContent className="p-6 text-sm text-muted-foreground">
                              No outstanding assignments or quizzes.
                            </CardContent>
                          </Card>
                        )}
                      </section>

                      {/* Completed Section */}
                      {completedTasks.length > 0 && (
                        <section className="flex flex-col gap-4 border-t pt-6">
                          <div>
                            <h3 className="font-semibold">Completed assignments</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {completedTasks.length} item{completedTasks.length === 1 ? '' : 's'}
                            </p>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {completedTasks.map((task) => {
                              const grade = grades.find(
                                (g) =>
                                  g.taskId === task.id || g.task_id === task.id,
                              );
                              return (
                                <Card key={task.id} className="shadow-none">
                                  <CardContent className="p-5">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                      <Badge variant="outline">
                                        Completed
                                      </Badge>
                                      <div className="text-xs text-muted-foreground">
                                        {(task.completedAt || task.dueDate) ? new Date(task.completedAt || task.dueDate).toLocaleDateString() : ""}
                                      </div>
                                    </div>
                                    <h4 className="font-medium">
                                      {task.title}
                                    </h4>
                                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                                      <div className="flex items-center gap-2">
                                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                                          {grade ? grade.grade || "✓" : "✓"}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          {grade ? "Graded" : "Submitted"}
                                        </p>
                                      </div>
                                      {grade && (
                                        <div className="flex flex-col items-end">
                                          <span className="font-semibold">
                                            {grade.grade}
                                          </span>
                                          {typeof grade.score === "number" && (
                                            <span className="text-xs text-muted-foreground">
                                              {grade.score}%
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </section>
                      )}
                    </div>
                  </div>
                )}

                {activeView === "leaderboard" && (
                  <StudentLeaderboard accessToken={accessToken} />
                )}
              </div>
        </div>

          {/* Notifications Dialog */}
          <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
            <DialogContent className="max-w-md p-0">
              <DialogHeader className="border-b p-5">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Bell aria-hidden="true" className="size-4" />
                  Notifications
                </DialogTitle>
                <DialogDescription>
                  {unreadCount === 0
                    ? "You are all caught up."
                    : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length > 0 ? (
                  <ul className="divide-y">
                    {notifications.map((notif) => (
                      <li key={notif.id}>
                        <button
                          type="button"
                          className={`w-full px-5 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                            !notif.read ? "bg-muted/40" : ""
                          }`}
                          onClick={() => {
                            markNotificationAsRead(notif.id);
                            handleNotificationClick(notif);
                          }}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <Badge variant={notif.read ? "outline" : "secondary"}>
                              {notif.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h5 className="text-sm font-medium">{notif.title}</h5>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {notif.message}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-8 text-center">
                    <Bell aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">
                      No notifications
                    </p>
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

          {/* Daily Quest Dialog */}
          <Dialog
            open={showDailyQuestDialog}
            onOpenChange={setShowDailyQuestDialog}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New task assigned</DialogTitle>
                <DialogDescription>
                  Review the details, then open your task list to get started.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <h3 className="font-medium">
                    {dailyQuest?.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {dailyQuest?.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap aria-hidden="true" className="size-4" />
                  <span>{dailyQuest?.points} XP</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowDailyQuestDialog(false);
                    markDailyQuestSeen();
                    setActiveView("tasks");
                  }}
                >
                  View tasks
                </Button>
              </div>
            </DialogContent>
          </Dialog>
      </>
  );
}
