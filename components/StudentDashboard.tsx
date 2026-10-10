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
import { Skeleton } from "./ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
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
  Zap,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  Info,
  AlertCircle,
  BookOpen,
  Loader2,
  RefreshCw,
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
  const [isGradesLoading, setIsGradesLoading] = useState(true);
  const [gradesError, setGradesError] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const activeView = pathname.split("/").filter(Boolean).at(-1) || "dashboard";
  const setActiveView = (view: string) => {
    router.push(view === "dashboard" ? "/student/dashboard" : `/student/dashboard/${view}`);
  };
  const [dailyQuest, setDailyQuest] = useState<any>(null);
  const [showDailyQuestDialog, setShowDailyQuestDialog] = useState(false);
  const [adminMessage, setAdminMessage] = useState<any>(null);
  const profileData = {
    name: student?.name || "",
    email: student?.email || "",
    prn: student?.prn || "",
    phone: student?.phone || "",
    address: student?.address || "",
    bio: student?.bio || "",
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
  const scoredGrades = grades.filter(
    (grade) => typeof grade.score === "number" && Number.isFinite(grade.score),
  );
  const averageGradeScore = scoredGrades.length
    ? Math.round(
        scoredGrades.reduce((total, grade) => total + grade.score, 0) / scoredGrades.length,
      )
    : null;

  useEffect(() => {
    loadStudentData();
    checkDailyQuest();
  }, []);

  const loadStudentData = async () => {
    setIsGradesLoading(true);
    setGradesError("");
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
        if (data.stats) {
          setStats(data.stats);
        } else {
          calculateStats(
            data.grades || [],
            data.tasks || [],
            data.streakData || { currentStreak: 0, longestStreak: 0 },
          );
        }
      } else {
        setGradesError("We couldn’t load your grades. Check your connection and try again.");
      }
    } catch (error) {
      console.error("Error loading student data:", error);
      setGradesError("We couldn’t load your grades. Check your connection and try again.");
      toast.error("Failed to load data");
    } finally {
      setIsGradesLoading(false);
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

  const startQuiz = (quiz: any) => {
    setSelectedQuiz(quiz);
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
                    accessToken={accessToken}
                    projectId={projectId}
                    onUpdate={loadStudentData}
                  />
                )}

                {/* Admin Broadcast Message - only show on dashboard */}
                {activeView === "dashboard" && adminMessage && (
                  <Alert className="mb-6" aria-labelledby="student-admin-message-heading">
                    <Info aria-hidden="true" />
                    <AlertDescription>
                      <span id="student-admin-message-heading" className="mb-1 block font-medium text-foreground">
                        Message from administration
                      </span>
                      {adminMessage}
                    </AlertDescription>
                  </Alert>
                )}

                {/* View Content based on activeView */}
                {activeView === "dashboard" && (
                  <div className="flex flex-col gap-8">
                    <section
                      aria-labelledby="student-overview-heading"
                      className="flex flex-wrap items-end justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <h2
                          id="student-overview-heading"
                          className="text-2xl font-semibold tracking-tight [text-wrap:balance]"
                        >
                          {profileData.name ? `Welcome back, ${profileData.name}` : "Your learning overview"}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Check your progress and see what needs attention.
                        </p>
                      </div>
                    </section>
                    <section aria-label="Learning progress" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Card className="border-primary/20 bg-primary/[0.035] shadow-none">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Level</p>
                              <p className="mt-2 text-3xl font-semibold tabular-nums">{stats.level}</p>
                            </div>
                            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Trophy aria-hidden="true" className="size-4" />
                            </span>
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
                            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <Star aria-hidden="true" className="size-4" />
                            </span>
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
                            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <Flame aria-hidden="true" className="size-4" />
                            </span>
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
                            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <CheckCircle2 aria-hidden="true" className="size-4" />
                            </span>
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
                    </section>

                    <section aria-labelledby="student-upcoming-heading" className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 id="student-upcoming-heading" className="text-lg font-semibold">
                            Upcoming work
                          </h3>
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
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight">Your grades</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Results for assignments and quizzes that have been reviewed.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={loadStudentData}
                        disabled={isGradesLoading}
                      >
                        {isGradesLoading ? (
                          <Loader2 aria-hidden="true" data-icon="inline-start" className="animate-spin text-primary" />
                        ) : (
                          <RefreshCw aria-hidden="true" data-icon="inline-start" />
                        )}
                        Refresh grades
                      </Button>
                    </div>

                    {isGradesLoading ? (
                      <div aria-busy="true" aria-label="Loading grades" className="space-y-3" role="status">
                        {Array.from({ length: 4 }, (_, index) => (
                          <Skeleton key={index} className="h-16 rounded-lg" />
                        ))}
                      </div>
                    ) : gradesError ? (
                      <Card className="shadow-none">
                        <CardContent className="flex flex-col items-start gap-4 p-6">
                          <AlertCircle aria-hidden="true" className="size-5 text-destructive" />
                          <p className="text-sm">{gradesError}</p>
                          <Button type="button" variant="outline" size="sm" onClick={loadStudentData}>
                            <RefreshCw aria-hidden="true" data-icon="inline-start" />
                            Try again
                          </Button>
                        </CardContent>
                      </Card>
                    ) : grades.length === 0 ? (
                      <Card className="shadow-none">
                        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                          <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <BookOpen aria-hidden="true" className="size-5" />
                          </span>
                          <h3 className="mt-4 font-medium">No grades yet</h3>
                          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                            Reviewed assignment and quiz results will appear here.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Card className="shadow-none">
                            <CardContent className="p-4">
                              <p className="text-sm text-muted-foreground">Average score</p>
                              <p className="mt-1 text-2xl font-semibold tabular-nums">
                                {averageGradeScore === null ? "—" : `${averageGradeScore}%`}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {averageGradeScore === null
                                  ? "Scores aren’t available for your graded work yet."
                                  : `Across ${scoredGrades.length} scored result${scoredGrades.length === 1 ? "" : "s"}`}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="shadow-none">
                            <CardContent className="p-4">
                              <p className="text-sm text-muted-foreground">Reviewed work</p>
                              <p className="mt-1 text-2xl font-semibold tabular-nums">{grades.length}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Assignment{grades.length === 1 ? "" : "s"} and quiz results
                              </p>
                            </CardContent>
                          </Card>
                        </div>

                        <Card className="shadow-none">
                          <CardContent className="p-0">
                            <div className="hidden md:block">
                              <Table>
                                <caption className="sr-only">Your graded assignments and quiz results</caption>
                                <TableHeader className="bg-muted/50">
                                  <TableRow>
                                    <TableHead>Assignment</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Result</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {grades.map((grade, index) => (
                                    <TableRow key={grade.id || `${grade.assignment}-${grade.date}-${index}`}>
                                      <TableCell className="max-w-64">
                                        <span className="block truncate font-medium">{grade.assignment}</span>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline">{grade.subject}</Badge>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {new Date(grade.date).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span className="font-semibold tabular-nums">{grade.grade || "—"}</span>
                                        {typeof grade.score === "number" && (
                                          <span className="ml-2 text-xs text-muted-foreground">{grade.score}%</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <ul className="divide-y md:hidden" aria-label="Graded assignments and quizzes">
                              {grades.map((grade, index) => (
                                <li
                                  key={grade.id || `${grade.assignment}-${grade.date}-${index}`}
                                  className="space-y-3 p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="min-w-0 flex-1 text-sm font-medium">
                                      {grade.assignment}
                                    </p>
                                    <div className="shrink-0 text-right">
                                      <p className="font-semibold tabular-nums">{grade.grade || "—"}</p>
                                      {typeof grade.score === "number" && (
                                        <p className="text-xs text-muted-foreground">{grade.score}%</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Badge variant="outline">{grade.subject}</Badge>
                                    <time className="text-xs text-muted-foreground" dateTime={grade.date}>
                                      {new Date(grade.date).toLocaleDateString()}
                                    </time>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      </>
                    )}
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
