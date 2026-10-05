"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Flame, Plus, RefreshCw, Search, Trophy, Users } from 'lucide-react';
import { RoleAvatar } from './RoleAvatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AddStudent } from './AddStudent';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

type RegistrationFilter = 'all' | 'portal' | 'roster';
type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

interface StudentRecord {
  id?: string | number;
  name?: string;
  email?: string;
  avatar?: string;
  rollNumber?: string | number;
  batch?: string;
  classId?: string | number | null;
  className?: string | null;
  class?: string | null;
  isRegistered?: boolean;
  isAssigned?: boolean;
  currentLevel?: number;
  totalPoints?: number;
  gameProgress?: number;
  averageGrade?: number;
  registeredAt?: string;
  streakData?: { currentStreak?: number; longestStreak?: number; dates?: string[] };
  taskData?: { completedCount?: number; totalCount?: number };
  [key: string]: unknown;
}

interface StudentActivity {
  streakData?: StudentRecord['streakData'];
  streak?: StudentRecord['streakData'];
  taskData?: StudentRecord['taskData'];
}

interface StudentsListProps {
  students: StudentRecord[];
  accessToken: string;
  onSelectStudent: (student: StudentRecord) => void;
  classes: Array<{ id?: string | number; name?: string; className?: string; subject?: string }>;
  onRefresh?: () => void;
  onAddStudent: (student: StudentRecord) => Promise<void>;
  initialRegistrationFilter?: RegistrationFilter;
}

const emptyStreak = { currentStreak: 0, longestStreak: 0, dates: [] };
const emptyTasks = { completedCount: 0, totalCount: 0 };

function isAssigned(student: StudentRecord) {
  return typeof student.isAssigned === 'boolean'
    ? student.isAssigned
    : Boolean(student.classId || student.className || student.class);
}

export function StudentsList({
  students,
  accessToken,
  onSelectStudent,
  classes,
  onRefresh,
  onAddStudent,
  initialRegistrationFilter = 'all',
}: StudentsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>(initialRegistrationFilter);
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [activityByEmail, setActivityByEmail] = useState<Record<string, StudentActivity>>({});
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

  useEffect(() => {
    let isActive = true;
    const fetchStudentData = async () => {
      if (!students.length || !accessToken) {
        setIsLoadingActivity(false);
        return;
      }

      setIsLoadingActivity(true);
      try {
        const response = await fetch('/api/teacher/students-batch-data', {
          method: 'POST',
          headers: {
            Authorization: ['Bearer', accessToken].join(' '),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emails: students.map(student => student.email).filter(Boolean) }),
        });

        if (!response.ok) throw new Error(`Student activity request failed (${response.status})`);
        const result = await response.json() as {
          students?: Record<string, StudentActivity>;
          studentsData?: Record<string, StudentActivity>;
        };
        const responseData = result.students || result.studentsData || {};
        const studentsDataByEmail = Object.fromEntries(
          Object.entries(responseData).map(([email, data]) => [email.toLowerCase(), data]),
        ) as Record<string, StudentActivity>;

        if (isActive) setActivityByEmail(studentsDataByEmail);
      } catch (error) {
        console.error('Error fetching batch student activity:', error);
        if (isActive) setActivityByEmail({});
      } finally {
        if (isActive) setIsLoadingActivity(false);
      }
    };

    void fetchStudentData();
    return () => { isActive = false; };
  }, [students, accessToken]);

  const studentsWithData = useMemo(() => students.map(student => {
    const activity = activityByEmail[String(student.email || '').toLowerCase()] || {};
    return {
      ...student,
      streakData: activity.streakData || activity.streak || student.streakData || emptyStreak,
      taskData: activity.taskData || student.taskData || emptyTasks,
    };
  }), [students, activityByEmail]);

  const batches = useMemo(() => {
    const values = new Set(['I BDS', 'II BDS', 'III BDS', 'IV BDS']);
    students.forEach(student => {
      if (student.batch) values.add(String(student.batch).trim());
    });
    return [...values].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const classNames = useMemo(() => {
    const values = new Set<string>();
    classes.forEach(classItem => {
      const name = classItem.name || classItem.className;
      if (name) values.add(String(name).trim());
    });
    students.forEach(student => {
      const name = student.className || student.class;
      if (name) values.add(String(name).trim());
    });
    return [...values].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [classes, students]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return studentsWithData.filter(student => {
      const className = student.className || student.class || '';
      const matchesSearch = !query || [
        student.name,
        student.email,
        className,
        student.rollNumber,
      ].some(value => String(value || '').toLowerCase().includes(query));
      const matchesBatch = batchFilter === 'all' || String(student.batch || '').trim() === batchFilter;
      const matchesClass = classFilter === 'all' || String(className).trim() === classFilter;
      const matchesRegistration = registrationFilter === 'all'
        || (registrationFilter === 'portal' ? Boolean(student.isRegistered) : !student.isRegistered);
      const assigned = isAssigned(student);
      const matchesAssignment = assignmentFilter === 'all'
        || (assignmentFilter === 'assigned' ? assigned : !assigned);
      return matchesSearch && matchesBatch && matchesClass && matchesRegistration && matchesAssignment;
    });
  }, [studentsWithData, searchTerm, batchFilter, classFilter, registrationFilter, assignmentFilter]);

  const renderStudentCard = (student: StudentRecord) => {
    const assigned = isAssigned(student);
    const className = student.className || student.class;
    const progress = Number(student.gameProgress) || 0;
    return (
      <Card key={student.id || student.email} className="h-full shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <RoleAvatar
              role="student"
              identifier={student.id || student.email}
              name={student.name || 'Student'}
              className="size-10"
            />
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-sm">{student.name || 'Unnamed student'}</CardTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {student.email}{student.rollNumber ? ` · Roll no. ${student.rollNumber}` : ''}
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="shrink-0 rounded-full"
                      aria-label="View in detail"
                      onClick={() => onSelectStudent(student)}
                    />
                  }
                >
                  <Eye aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>View in detail</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 divide-x rounded-lg bg-muted/50 py-2">
            <div className="px-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Flame aria-hidden="true" className="size-3.5" />
                <span>Streak</span>
              </div>
              <p className="mt-1 text-base font-semibold tabular-nums">{student.streakData?.currentStreak || 0}</p>
            </div>
            <div className="px-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
                <span>Tasks</span>
              </div>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {student.taskData?.completedCount || 0}/{student.taskData?.totalCount || 0}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Trophy aria-hidden="true" className="size-3.5" />
              Level {student.currentLevel ?? 1}
            </span>
            <span className="font-medium tabular-nums">{student.totalPoints || 0} EXP</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={`${student.name || 'Student'} game progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.max(0, progress))}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{progress}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs">
            <span className="min-w-0 truncate text-muted-foreground">
              {assigned ? className || 'Assigned to a class' : 'Not assigned'}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{student.averageGrade ?? 0}% avg.</span>
          </div>

        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Button onClick={() => setIsAddStudentOpen(true)}>
          <Plus data-icon="inline-start" />
          Add student
        </Button>
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" className="shrink-0">
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        )}
      </div>

      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add a student</DialogTitle>
            <DialogDescription>
              Add a roster record and assign it to one of your classes.
            </DialogDescription>
          </DialogHeader>
          <AddStudent
            classes={classes.filter((classItem): classItem is typeof classItem & { id: string | number; name: string } =>
              classItem.id !== undefined && Boolean(classItem.name)
            )}
            onAddStudent={onAddStudent}
            onBack={() => setIsAddStudentOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <section aria-label="Student filters" className="rounded-2xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
            <Label htmlFor="student-search">Search</Label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="student-search"
                placeholder="Name, email, roll no."
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-batch">BDS batch</Label>
            <Select value={batchFilter} onValueChange={value => setBatchFilter(value ?? 'all')}>
              <SelectTrigger id="student-batch" className="w-full">
                <SelectValue placeholder="All batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All batches</SelectItem>
                {batches.map(batch => <SelectItem key={batch} value={batch}>{batch}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-class">Class</Label>
            <Select value={classFilter} onValueChange={value => setClassFilter(value ?? 'all')}>
              <SelectTrigger id="student-class" className="w-full">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classNames.map(className => <SelectItem key={className} value={className}>{className}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-registration">Registration</Label>
            <Select
              value={registrationFilter}
              onValueChange={value => setRegistrationFilter((value ?? 'all') as RegistrationFilter)}
            >
              <SelectTrigger id="student-registration" className="w-full">
                <SelectValue placeholder="Any type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="portal">Portal accounts</SelectItem>
                <SelectItem value="roster">Roster entries</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-assignment">Class assignment</Label>
            <Select
              value={assignmentFilter}
              onValueChange={value => setAssignmentFilter((value ?? 'all') as AssignmentFilter)}
            >
              <SelectTrigger id="student-assignment" className="w-full">
                <SelectValue placeholder="Any assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {isLoadingActivity && <p className="text-sm text-muted-foreground" role="status">Loading student activity…</p>}

      {filteredStudents.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredStudents.map(renderStudentCard)}
        </div>
      ) : (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users aria-hidden="true" className="size-6" />
            </div>
            <h3 className="font-semibold">
              {students.length ? 'No students match these filters' : 'No student records yet'}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {students.length
                ? 'Try changing your search or filter selections.'
                : 'Students you add to the roster or who register through the portal will appear here.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
