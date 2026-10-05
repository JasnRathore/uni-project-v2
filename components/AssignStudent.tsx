"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { RoleAvatar } from './RoleAvatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, UserPlus, UserMinus, Trophy, Star, Flame, CheckCircle2, ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from './utils/supabase/info';

interface AssignStudentProps {
  student: any;
  classes: any[];
  onBack: () => void;
  onAssignSuccess: () => void;
  accessToken: string;
}

export function AssignStudent({ student, classes, onBack, onAssignSuccess, accessToken }: AssignStudentProps) {
  const [selectedClassId, setSelectedClassId] = useState(student.classId || '');
  const [isAssigning, setIsAssigning] = useState(false);
  const [streakData, setStreakData] = useState({ currentStreak: 0, longestStreak: 0, dates: [] });
  const [taskData, setTaskData] = useState({ completedCount: 0, totalCount: 0 });
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch streak and task data
  useEffect(() => {
    const fetchStudentData = async () => {
      setIsLoadingData(true);
      try {
        // Fetch streak data
        const streakResponse = await fetch(
          `/api/teacher/student-streak/${student.email}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (streakResponse.ok) {
          const result = await streakResponse.json();
          setStreakData(result.streakData || { currentStreak: 0, longestStreak: 0, dates: [] });
        }

        // Fetch task data
        const tasksResponse = await fetch(
          `/api/teacher/student-tasks/${student.email}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (tasksResponse.ok) {
          const result = await tasksResponse.json();
          const tasks = result.tasks || [];
          setTaskData({
            completedCount: tasks.filter(t => t.completed).length,
            totalCount: tasks.length
          });
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (student && student.email && accessToken) {
      fetchStudentData();
    }
  }, [student, accessToken]);

  const handleAssignToClass = async () => {
    if (!selectedClassId) {
      toast.error('Please select a class');
      return;
    }

    setIsAssigning(true);
    try {
      const selectedClass = classes.find((c: any) => c.id === selectedClassId);
      
      const response = await fetch(`/api/teacher/assign-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          studentId: student.id,
          studentEmail: student.email,
          classId: selectedClassId,
          className: selectedClass.name
        })
      });

      if (response.ok) {
        toast.success(`${student.name} assigned to ${selectedClass.name}`);
        if (onAssignSuccess) {
          onAssignSuccess();
        }
        onBack();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to assign student');
      }
    } catch (error) {
      console.error('Error assigning student:', error);
      toast.error('Failed to assign student');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async () => {
    setIsAssigning(true);
    try {
      const response = await fetch(`/api/teacher/unassign-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          studentId: student.id
        })
      });

      if (response.ok) {
        toast.success(`${student.name} unassigned from class`);
        if (onAssignSuccess) {
          onAssignSuccess();
        }
        onBack();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to unassign student');
      }
    } catch (error) {
      console.error('Error unassigning student:', error);
      toast.error('Failed to unassign student');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <Button onClick={onBack} variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Students
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        {/* Student Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Student Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <RoleAvatar
                role="student"
                identifier={student.id || student.email}
                name={student.name || 'Student'}
                className="size-16 ring-2 ring-primary/20"
                fallbackClassName="text-lg"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">{student.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{student.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 rounded-lg border bg-muted/50 p-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Level</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{student.currentLevel}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">EXP</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{student.totalPoints}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-sm font-medium">Avg Grade</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{student.averageGrade}%</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg border bg-muted/50 p-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Current Streak</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{streakData.currentStreak}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Longest Streak</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{streakData.longestStreak}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <ListTodo className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Tasks</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{taskData.completedCount}/{taskData.totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class Assignment Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Class Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {student.isAssigned && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  Currently Assigned To:
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {student.className}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Class</label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No classes available. Create a class first.
                    </div>
                  ) : (
                    classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleAssignToClass}
                disabled={isAssigning || !selectedClassId || classes.length === 0}
                className="flex-1"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {student.isAssigned ? 'Update Assignment' : 'Assign to Class'}
              </Button>

              {student.isAssigned && (
                <Button
                  onClick={handleUnassign}
                  disabled={isAssigning}
                  variant="destructive"
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  Unassign
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
