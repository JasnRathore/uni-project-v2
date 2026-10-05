"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const letterGrades = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"];

interface TaskSubmissionsPageProps {
  task: {
    id: string | number;
    title: string;
    className?: string;
    type?: string;
  };
  accessToken: string;
  onBack: () => void;
}

interface TaskStudent {
  id?: string | number;
  name?: string;
  email?: string;
  grade?: string;
}

export function TaskSubmissionsPage({ task, accessToken, onBack }: TaskSubmissionsPageProps) {
  const [students, setStudents] = useState<TaskStudent[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [savingEmails, setSavingEmails] = useState<string[]>([]);

  useEffect(() => {
    let isActive = true;

    const loadSubmissions = async () => {
      setIsLoading(true);
      try {
        const [studentsResponse, gradesResponse] = await Promise.all([
          fetch("/api/teacher/task-students", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ taskId: task.id, listType: "assigned" }),
          }),
          fetch(`/api/teacher/task-grades/${encodeURIComponent(String(task.id))}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        const [studentsData, gradesData] = await Promise.all([
          studentsResponse.json().catch(() => ({})),
          gradesResponse.json().catch(() => ({})),
        ]);
        if (!studentsResponse.ok) {
          throw new Error(studentsData.error || `Failed to load assigned students (${studentsResponse.status})`);
        }
        if (!gradesResponse.ok) {
          throw new Error(gradesData.error || `Failed to load grades (${gradesResponse.status})`);
        }

        if (isActive) {
          setStudents(Array.isArray(studentsData.students) ? studentsData.students : []);
          setGrades(gradesData.grades || {});
        }
      } catch (error) {
        console.error("Error loading task submissions:", error);
        if (isActive) toast.error(error instanceof Error ? error.message : "Failed to load task submissions.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadSubmissions();
    return () => { isActive = false; };
  }, [accessToken, task.id]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return students.filter(student => {
      const matchesSearch = !query || [student.name, student.email]
        .some(value => String(value || "").toLowerCase().includes(query));
      const grade = grades[student.email || ""] || student.grade;
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "graded" && Boolean(grade))
        || (statusFilter === "pending" && !grade);
      return matchesSearch && matchesStatus;
    });
  }, [grades, searchTerm, statusFilter, students]);

  const handleGradeChange = async (student: TaskStudent, grade: string | null) => {
    if (!student.email || !grade) return;
    const email = student.email;
    const previousGrade = grades[email];
    setSavingEmails(current => [...current, email]);
    setGrades(current => ({ ...current, [email]: grade }));

    try {
      const response = await fetch("/api/teacher/task-grade", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId: task.id, studentEmail: email, grade }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Failed to save grade (${response.status})`);
      toast.success(`Grade ${grade} saved.`);
    } catch (error) {
      console.error("Error saving student grade:", error);
      setGrades(current => {
        const next = { ...current };
        if (previousGrade) next[email] = previousGrade;
        else delete next[email];
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Failed to save grade.");
    } finally {
      setSavingEmails(current => current.filter(item => item !== email));
    }
  };

  const gradedCount = students.filter(student => Boolean(grades[student.email || ""] || student.grade)).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Back to tasks and quizzes">
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{task.title}</h2>
            <p className="text-sm text-muted-foreground">
              {task.className || "All students"} · {task.type === "quiz" ? "Quiz submissions" : "Task submissions"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <Users aria-hidden="true" className="size-4" />
          <span>{gradedCount} of {students.length} graded</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search assigned students"
            placeholder="Search students"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={value => setStatusFilter(value ?? "all")}>
          <SelectTrigger aria-label="Filter submission status" className="w-full sm:w-40">
            <SelectValue placeholder="All submissions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All submissions</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="graded">Graded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading submissions">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filteredStudents.length ? (
        <div className="flex flex-col gap-2">
          {filteredStudents.map((student, index) => {
            const grade = grades[student.email || ""] || student.grade || "";
            const isSaving = Boolean(student.email && savingEmails.includes(student.email));
            return (
              <Card key={student.email || student.id || index} className="gap-0 py-0 shadow-none">
                <CardContent className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Users aria-hidden="true" className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{student.name || "Unknown student"}</p>
                      <p className="truncate text-xs text-muted-foreground">{student.email || "No email available"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <Badge variant={grade ? "default" : "secondary"}>
                      {grade ? <CheckCircle2 data-icon="inline-start" /> : <Clock data-icon="inline-start" />}
                      {grade ? `Graded · ${grade}` : "Pending"}
                    </Badge>
                    <Select
                      value={grade}
                      disabled={!student.email || isSaving}
                      onValueChange={value => void handleGradeChange(student, value)}
                    >
                      <SelectTrigger aria-label={`Grade ${student.name || "student"}`} className="w-28">
                        <SelectValue placeholder="Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {letterGrades.map(letterGrade => (
                          <SelectItem key={letterGrade} value={letterGrade}>{letterGrade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Users aria-hidden="true" className="size-8 text-muted-foreground" />
            <h3 className="font-semibold">{students.length ? "No matching students" : "No students assigned"}</h3>
            <p className="text-sm text-muted-foreground">
              {students.length ? "Try another name or submission filter." : "Students assigned to this task will appear here."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
