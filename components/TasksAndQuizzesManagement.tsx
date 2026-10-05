"use client";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  ListTodo,
  Clock,
  CheckCircle2,
  Users,
  Calendar,
  Edit2,
  Trash2,
  BookOpen,
  Target,
  AlertCircle,
  FileText,
  Brain,
  Plus,
  Search,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { KpiCard } from "./ui/kpi-card";
import { AddTask } from "./AddTask";
import { AddQuiz } from "./AddQuiz";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface TasksAndQuizzesManagementProps {
  tasks: any[];
  classes: any[];
  students: any[];
  onEditTask: (task: any) => void;
  onDeleteTask: (taskId: any) => Promise<boolean>;
  onCreateTask: (task: any) => void;
  onManageStudents: (task: any) => void;
  accessToken: string;
}

export function TasksAndQuizzesManagement({
  tasks,
  classes,
  students,
  onEditTask,
  onDeleteTask,
  onCreateTask,
  onManageStudents,
  accessToken,
}: TasksAndQuizzesManagementProps) {
  const [taskStats, setTaskStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [deletingTaskId, setDeletingTaskId] = useState<any>(null);
  const [creationType, setCreationType] = useState<"task" | "quiz" | null>(null);
  const [creationClassId, setCreationClassId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const creationClass = classes.find(classItem => String(classItem.id) === creationClassId);
  const selectedCreationClass = creationClass
    ? {
        ...creationClass,
        studentCount: students.filter(student => String(student.classId) === String(creationClass.id)).length,
      }
    : null;

  const openCreationDialog = (type: "task" | "quiz") => {
    if (!classes.length) {
      toast.error("Add a class before creating a task or quiz.");
      return;
    }
    setCreationClassId("");
    setCreationType(type);
  };

  const closeCreationDialog = () => {
    setCreationType(null);
    setCreationClassId("");
  };

  const handleDeleteTask = async (taskId: any) => {
    setDeletingTaskId(taskId);
    try {
      await onDeleteTask(taskId);
    } finally {
      setDeletingTaskId(null);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      console.error(
        "ERROR: accessToken is missing in TasksAndQuizzesManagement",
      );
      toast.error("Configuration error: Access token is missing");
    }
  }, [accessToken]);

  useEffect(() => {
    calculateTaskStats();
  }, [tasks, students]);

  const calculateTaskStats = async () => {
    setLoading(true);

    try {
      // Fetch all task statistics in one API call
      const response = await fetch(
        `/api/teacher/task-stats`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Task statistics loaded:", data.taskStats);
        setTaskStats(data.taskStats || {});
      } else {
        console.error("Failed to load task statistics");
        toast.error("Failed to load task statistics");
      }
    } catch (error) {
      console.error("Error fetching task statistics:", error);
      toast.error("Error loading statistics");
    }

    setLoading(false);
  };

  const formatDate = (dateString: any) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPriorityColor = (priority: any) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "border-destructive/30 bg-destructive/10 text-destructive";
      case "medium":
        return "border-border bg-muted text-muted-foreground";
      case "low":
        return "border-border bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (completionRate: any) => {
    if (completionRate >= 80) return "text-foreground bg-muted";
    if (completionRate >= 50) return "text-muted-foreground bg-muted";
    return "text-destructive bg-destructive/10";
  };

  const isOverdue = (dueDate: any) => {
    return new Date(dueDate) < new Date();
  };

  const allTasks = [...(tasks || [])].sort((a, b) => {
    // Sort by createdAt or id timestamp newest first
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (typeof a.id === 'string' ? parseInt(a.id.split('-')[1]) || 0 : 0);
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (typeof b.id === 'string' ? parseInt(b.id.split('-')[1]) || 0 : 0);
    return timeB - timeA;
  });
  const regularTasks = allTasks.filter((t) => t.type !== "quiz");
  const quizzes = allTasks.filter((t) => t.type === "quiz");
  const selectedClassName = classes.find(classItem => String(classItem.id) === classFilter)?.name;
  const filteredTasks = allTasks.filter(task => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || [
      task.title,
      task.description,
      task.className,
      task.subject,
    ].some(value => String(value || "").toLowerCase().includes(query));
    const matchesClass = classFilter === "all"
      || String(task.classId || "") === classFilter
      || (Boolean(selectedClassName) && task.className === selectedClassName);
    const overdue = isOverdue(task.dueDate);
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "active" && task.status === "active" && !overdue)
      || (statusFilter === "inactive" && task.status !== "active")
      || (statusFilter === "overdue" && task.status === "active" && overdue);
    return matchesSearch && matchesClass && matchesStatus;
  });
  const filteredRegularTasks = filteredTasks.filter(task => task.type !== "quiz");
  const filteredQuizzes = filteredTasks.filter(task => task.type === "quiz");

  const renderTaskCard = (task: any) => {
    const overdue = isOverdue(task.dueDate);
    const isQuiz = task.type === "quiz";

    return (
      <Card
        key={task.id}
        className="gap-0 py-0 shadow-none transition-shadow hover:shadow-md"
      >
        <CardHeader className="gap-2 p-4 pb-2">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex min-w-0 items-center gap-2">
                {isQuiz ? (
                  <Brain aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                )}
                <CardTitle className="truncate text-base">{task.title}</CardTitle>
              </div>
              <div className="mb-1 flex flex-wrap gap-1.5">
                <Badge variant="secondary">
                  {isQuiz ? "Quiz" : "Task"}
                </Badge>
                <Badge className={getPriorityColor(task.priority)}>
                  {task.priority || "Medium"} Priority
                </Badge>
                {overdue && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Overdue
                  </Badge>
                )}
                {task.status === "active" ? (
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`View students for ${task.title}`}
                        onClick={() => onManageStudents(task)}
                        className="rounded-full text-muted-foreground"
                      />
                    }
                  >
                    <Users />
                  </TooltipTrigger>
                  <TooltipContent>View students</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Edit ${task.title}`}
                onClick={() => onEditTask(task)}
                className="text-muted-foreground"
              >
                <Edit2 />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Delete ${task.title}`}
                onClick={() => handleDeleteTask(task.id)}
                disabled={deletingTaskId !== null}
                className="text-destructive hover:bg-destructive/10"
              >
                {deletingTaskId === task.id ? (
                  <span className="text-xs">Deleting...</span>
                ) : (
                  <Trash2 />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4 pt-0">
          {task.description && (
            <Collapsible className="rounded-lg border bg-muted/30">
              <CollapsibleTrigger
                className="group flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                <span>View description</span>
                <ChevronDown className="size-4 shrink-0 transition-transform group-data-[open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t px-3 py-3 text-sm text-muted-foreground">
                {task.description}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Task Details */}
          <div className="grid min-w-0 grid-cols-1 gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-2">
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Class</p>
                <p className="truncate text-sm font-medium">{task.className || "All students"}</p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <Calendar className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="text-sm font-medium">
                  {formatDate(task.dueDate)}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <Target className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Points</p>
                <p className="text-sm font-medium">
                  {task.totalPoints || task.maxPoints}
                </p>
              </div>
            </div>

            {isQuiz && (
              <div className="flex min-w-0 items-center gap-2">
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-medium">{task.duration} min</p>
                </div>
              </div>
            )}

            {!isQuiz && (
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="text-sm font-medium">{task.subject}</p>
                </div>
              </div>
            )}
          </div>

          {/* Statistics - REMOVED Progress Bar and Completion Text */}
          <div className="flex items-center justify-between gap-3">
            {isQuiz ? (
              <span className="text-xs text-muted-foreground">{task.questions?.length || 0} questions</span>
            ) : (
              <span />
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => openCreationDialog("task")}>
          <Plus data-icon="inline-start" />
          Create task
        </Button>
        <Button onClick={() => openCreationDialog("quiz")}>
          <Plus data-icon="inline-start" />
          Create quiz
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tasks" value={regularTasks.length} icon={<FileText aria-hidden="true" />} />
        <KpiCard label="Quizzes" value={quizzes.length} icon={<Brain aria-hidden="true" />} />
        <KpiCard
          label="Active"
          value={allTasks.filter(task => task.status === "active").length}
          icon={<CheckCircle2 aria-hidden="true" />}
        />
        <KpiCard
          label="Overdue"
          value={allTasks.filter(task => task.status === "active" && isOverdue(task.dueDate)).length}
          icon={<AlertCircle aria-hidden="true" />}
        />
      </div>

      <Tabs defaultValue="all" className="w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full grid-cols-3 sm:w-[min(100%,28rem)]">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          </TabsList>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <div className="relative sm:w-56">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search tasks and quizzes"
                placeholder="Search tasks and quizzes"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={classFilter} onValueChange={value => setClassFilter(value ?? "all")}>
              <SelectTrigger aria-label="Filter by class" className="w-full sm:w-48">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map(classItem => (
                  <SelectItem key={classItem.id} value={String(classItem.id)}>
                    {classItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={value => setStatusFilter(value ?? "all")}>
              <SelectTrigger aria-label="Filter by status" className="w-full sm:w-36">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="all" className="mt-4">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                  <ListTodo className="size-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-medium">
                  {allTasks.length ? "No matching tasks or quizzes" : "No Tasks or Quizzes Yet"}
                </h3>
                <p className="text-muted-foreground">
                  {allTasks.length
                    ? "Try adjusting your search or filters."
                    : "Use Create task or Create quiz above to add the first item."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 2xl:grid-cols-2">
              {filteredTasks.map((task) => renderTaskCard(task))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {filteredRegularTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                  <FileText className="size-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-medium">
                  {regularTasks.length ? "No matching tasks" : "No Tasks Created"}
                </h3>
                <p className="text-muted-foreground">
                  {regularTasks.length ? "Try adjusting your search or filters." : "Create a task with the button above."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 2xl:grid-cols-2">
              {filteredRegularTasks.map((task) => renderTaskCard(task))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="mt-4">
          {filteredQuizzes.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                  <Brain className="size-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-medium">
                  {quizzes.length ? "No matching quizzes" : "No Quizzes Created"}
                </h3>
                <p className="text-muted-foreground">
                  {quizzes.length ? "Try adjusting your search or filters." : "Create a quiz with the button above."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 2xl:grid-cols-2">
              {filteredQuizzes.map((task) => renderTaskCard(task))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={creationType !== null}
        onOpenChange={open => { if (!open) closeCreationDialog(); }}
      >
        <DialogContent className={selectedCreationClass
          ? "flex h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)]"
          : "flex w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0"}>
          <DialogHeader className="shrink-0 border-b px-5 py-5 pr-14 sm:px-7 sm:py-6 lg:px-8">
            <DialogTitle>Create {creationType === "quiz" ? "quiz" : "task"}</DialogTitle>
            <DialogDescription>
              Choose the class for this {creationType || "task"}, then fill in its details.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 sm:max-w-xl">
                <Label htmlFor="creation-class">Class</Label>
                <Select value={creationClassId} onValueChange={value => setCreationClassId(value ?? "")}>
                  <SelectTrigger id="creation-class" className="w-full">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(classItem => (
                      <SelectItem key={classItem.id} value={String(classItem.id)}>
                        {classItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCreationClass && creationType === "task" && (
                <AddTask
                  key={`${creationType}-${selectedCreationClass.id}`}
                  classData={selectedCreationClass}
                  students={students}
                  accessToken={accessToken}
                  embedded
                  onBack={closeCreationDialog}
                  onAddTask={onCreateTask}
                />
              )}
              {selectedCreationClass && creationType === "quiz" && (
                <AddQuiz
                  key={`${creationType}-${selectedCreationClass.id}`}
                  classData={selectedCreationClass}
                  students={students}
                  accessToken={accessToken}
                  embedded
                  onBack={closeCreationDialog}
                  onAddQuiz={onCreateTask}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
