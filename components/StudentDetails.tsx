"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Flame,
  GraduationCap,
  ListTodo,
  Star,
  Trophy,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { RoleAvatar } from './RoleAvatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface ClassMembership {
  classId?: string | number;
  className?: string;
  status?: string;
  addedAt?: string;
}

interface StudentRecord {
  id: string | number;
  name?: string;
  email?: string;
  prn?: string | number;
  degreeName?: string;
  cohortLabel?: string;
  lifecycleState?: string;
  registeredAt?: string;
  currentLevel?: number;
  totalPoints?: number;
  averageGrade?: number;
  classId?: string | number | null;
  className?: string | null;
  classMemberships?: ClassMembership[];
}

interface ClassRecord {
  id: string | number;
  name: string;
  classStatus?: string;
  class_status?: string;
}

interface StudentDetailsProps {
  student: StudentRecord;
  classes: ClassRecord[];
  onAssignSuccess: () => void;
  accessToken: string;
}

const isActiveClass = (classItem: ClassRecord) =>
  (classItem.classStatus || classItem.class_status || 'active') === 'active';

function formatDate(value?: string) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not provided'
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

export function StudentDetails({ student, classes, onAssignSuccess, accessToken }: StudentDetailsProps) {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [updatingClassId, setUpdatingClassId] = useState<string | null>(null);
  const [streakData, setStreakData] = useState({ currentStreak: 0, longestStreak: 0 });
  const [taskData, setTaskData] = useState({ completedCount: 0, totalCount: 0 });
  const [isLoadingData, setIsLoadingData] = useState(false);

  const ownedClasses = useMemo(() => classes.filter(isActiveClass), [classes]);
  const activeMemberships = useMemo(() => {
    const memberships = (student.classMemberships || [])
      .filter(membership => membership.status === 'active')
      .flatMap(membership => {
        const classItem = classes.find(item => String(item.id) === String(membership.classId));
        return classItem ? [{ ...membership, classId: classItem.id, className: classItem.name }] : [];
      })

    if (memberships.length || !student.classId) return memberships;
    const legacyClass = classes.find(item => String(item.id) === String(student.classId));
    return legacyClass ? [{
      classId: legacyClass.id,
      className: legacyClass.name || student.className || '',
      status: 'active',
    }] : [];
  }, [classes, student.classId, student.classMemberships, student.className]);

  const assignedClassIds = useMemo(
    () => new Set(activeMemberships.map(membership => String(membership.classId))),
    [activeMemberships],
  );
  const availableClasses = useMemo(
    () => ownedClasses.filter(classItem => !assignedClassIds.has(String(classItem.id))),
    [assignedClassIds, ownedClasses],
  );

  const selectedAvailableClassId = availableClasses.some(classItem => String(classItem.id) === selectedClassId)
    ? selectedClassId
    : String(availableClasses[0]?.id || '');

  useEffect(() => {
    const controller = new AbortController();
    const fetchStudentData = async () => {
      setIsLoadingData(true);
      setStreakData({ currentStreak: 0, longestStreak: 0 });
      setTaskData({ completedCount: 0, totalCount: 0 });
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [streakResponse, tasksResponse] = await Promise.all([
          fetch(`/api/teacher/student-streak/${encodeURIComponent(student.email || '')}`, {
            headers,
            signal: controller.signal,
          }),
          fetch(`/api/teacher/student-tasks/${encodeURIComponent(student.email || '')}`, {
            headers,
            signal: controller.signal,
          }),
        ]);

        if (streakResponse.ok) {
          const result = await streakResponse.json();
          setStreakData(result.streakData || { currentStreak: 0, longestStreak: 0 });
        }
        if (tasksResponse.ok) {
          const result = await tasksResponse.json();
          const tasks = Array.isArray(result.tasks) ? result.tasks : [];
          setTaskData({
            completedCount: tasks.filter((task: { completed?: boolean }) => task.completed).length,
            totalCount: tasks.length,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Error fetching student data:', error);
      } finally {
        if (!controller.signal.aborted) setIsLoadingData(false);
      }
    };

    if (student.email && accessToken) void fetchStudentData();
    return () => controller.abort();
  }, [student.email, accessToken]);

  const handleAssignToClass = async () => {
    const selectedClass = availableClasses.find(classItem => String(classItem.id) === selectedAvailableClassId);
    if (!selectedClass) {
      toast.error('Choose one of your active classes');
      return;
    }

    setUpdatingClassId(selectedAvailableClassId);
    try {
      const response = await fetch(`/api/teacher/classes/${encodeURIComponent(selectedAvailableClassId)}/memberships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ studentId: student.id }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to add student to class');
      }

      toast.success(`${student.name || 'Student'} added to ${selectedClass.name}`);
      onAssignSuccess();
    } catch (error) {
      console.error('Error assigning student:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add student to class');
    } finally {
      setUpdatingClassId(null);
    }
  };

  const handleUnassign = async (classId: string | number) => {
    const normalizedClassId = String(classId);
    setUpdatingClassId(normalizedClassId);
    try {
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(normalizedClassId)}/memberships/${encodeURIComponent(String(student.id))}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to remove student from class');
      }

      toast.success(`${student.name || 'Student'} removed from class`);
      onAssignSuccess();
    } catch (error) {
      console.error('Error unassigning student:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove student from class');
    } finally {
      setUpdatingClassId(null);
    }
  };

  const academicDetails = [
    { label: 'PRN', value: student.prn, icon: BookOpen },
    {
      label: 'Programme and cohort',
      value: [student.degreeName, student.cohortLabel].filter(Boolean).join(' · '),
      icon: GraduationCap,
    },
    { label: 'Account status', value: student.lifecycleState, icon: CheckCircle2 },
    { label: 'Registered', value: student.registeredAt ? formatDate(student.registeredAt) : '', icon: CalendarDays },
  ].filter(detail => detail.value !== undefined && detail.value !== null && String(detail.value).trim() !== '');

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-4">
                <RoleAvatar
                  role="student"
                  identifier={student.id || student.email}
                  name={student.name || 'Student'}
                  className="size-14 ring-2 ring-primary/15"
                />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-xl font-semibold">{student.name || 'Unnamed student'}</CardTitle>
                  <CardDescription className="mt-1 break-all">
                    {student.email || 'No email address'}
                  </CardDescription>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  Student
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-5 sm:grid-cols-3">
                {academicDetails.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                      {label}
                    </p>
                    <p className="mt-1 break-words text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Learning activity</CardTitle>
              <CardDescription>Progress and participation across this professor&apos;s work.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Level', value: student.currentLevel ?? 1, icon: Trophy },
                  { label: 'Experience', value: `${student.totalPoints ?? 0} EXP`, icon: Star },
                  { label: 'Average grade', value: `${student.averageGrade ?? 0}%`, icon: CheckCircle2 },
                  { label: 'Current streak', value: streakData.currentStreak, icon: Flame },
                  { label: 'Longest streak', value: streakData.longestStreak, icon: Flame },
                  { label: 'Tasks completed', value: `${taskData.completedCount}/${taskData.totalCount}`, icon: ListTodo },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl bg-muted/50 p-3 sm:p-4">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon aria-hidden="true" className="size-3.5" />
                      {label}
                    </p>
                    <p className="mt-2 text-lg font-semibold tabular-nums">
                      {isLoadingData && ['Current streak', 'Longest streak', 'Tasks completed'].includes(label) ? '—' : value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
            <CardDescription>Classes this professor has added the student to.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {activeMemberships.length ? (
              <ul className="divide-y rounded-2xl border">
                {activeMemberships.map(membership => {
                  const membershipClassId = String(membership.classId);
                  return (
                    <li key={membershipClassId} className="flex items-center gap-3 p-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <BookOpen aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{membership.className}</span>
                        <span className="text-xs text-muted-foreground">Active membership</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${student.name || 'student'} from ${membership.className}`}
                        disabled={updatingClassId !== null}
                        onClick={() => handleUnassign(membership.classId!)}
                      >
                        <UserMinus aria-hidden="true" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-2xl bg-muted/50 px-4 py-5 text-sm text-muted-foreground">
                This student has not been added to any of your classes yet.
              </p>
            )}

            {availableClasses.length ? (
              <div className="space-y-3 border-t pt-5">
                <div>
                  <p className="text-sm font-medium">Add to another class</p>
                  <p className="mt-1 text-xs text-muted-foreground">Only your active classes are available.</p>
                </div>
                <Select value={selectedAvailableClassId} onValueChange={value => setSelectedClassId(value ?? '')}>
                  <SelectTrigger aria-label="Choose one of your active classes" className="w-full">
                    <SelectValue placeholder="Choose a class…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map(classItem => (
                      <SelectItem key={classItem.id} value={String(classItem.id)}>
                        {classItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssignToClass}
                  disabled={updatingClassId !== null || !selectedAvailableClassId}
                  className="w-full"
                >
                  <UserPlus aria-hidden="true" />
                  Add to class
                </Button>
              </div>
            ) : (
              <p className="border-t pt-5 text-sm text-muted-foreground">
                {ownedClasses.length
                  ? 'The student is already in all of your active classes.'
                  : 'Create an active class before adding this student to one.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
