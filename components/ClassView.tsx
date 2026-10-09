"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from './ui/combobox';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { RoleAvatar } from './RoleAvatar';
import { 
  ArrowLeft, 
  Users, 
  BookOpen, 
  Award, 
  User,
  Target,
  BarChart3,
  GraduationCap,
  Plus,
  UserPlus,
  CheckCircle,
  XCircle,
  Flame,
  CheckCircle2,
  ListTodo,
  Eye,
} from 'lucide-react';

// Dental college subjects
const dentalSubjects = [
  "Oral Pathology",
  "Orthodontics",
  "Conservative Dentistry",
  "Prosthodontics",
  "Periodontics",
  "Oral Surgery",
  "Pedodontics",
  "Public Health Dentistry",
  "Oral Medicine",
  "Oral Anatomy",
  "Endodontics",
  "Oral Radiology"
];

// Letter grades with descriptions
const letterGrades = [
  { value: 'A+', label: 'A+', percentage: 97, description: 'Outstanding' },
  { value: 'A', label: 'A', percentage: 93, description: 'Excellent' },
  { value: 'A-', label: 'A-', percentage: 90, description: 'Very Good' },
  { value: 'B+', label: 'B+', percentage: 87, description: 'Good' },
  { value: 'B', label: 'B', percentage: 83, description: 'Above Average' },
  { value: 'B-', label: 'B-', percentage: 80, description: 'Average' },
  { value: 'C+', label: 'C+', percentage: 77, description: 'Below Average' },
  { value: 'C', label: 'C', percentage: 73, description: 'Fair' },
  { value: 'C-', label: 'C-', percentage: 70, description: 'Pass' },
  { value: 'D', label: 'D', percentage: 65, description: 'Minimum Pass' },
  { value: 'F', label: 'F', percentage: 0, description: 'Fail' }
];

interface ClassViewProps {
  classData: any;
  students: any[];
  onBack: () => void;
  onAddTask: (task: any) => void;
  onAddQuiz: (quiz: any) => void;
  onStudentAssigned?: () => void;
  onViewStudent?: (student: any) => void;
  accessToken: string;
  projectId: string;
}

export function ClassView({ classData, students, onBack, onAddTask, onAddQuiz, onStudentAssigned, onViewStudent, accessToken, projectId }: ClassViewProps) {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [studentToAssign, setStudentToAssign] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  const [studentAttemptedTasks, setStudentAttemptedTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [studentsWithData, setStudentsWithData] = useState<any[]>([]);
  const [studentDataRefreshKey, setStudentDataRefreshKey] = useState(0);
  const [isLoadingStudentData, setIsLoadingStudentData] = useState(false);
  const [newGrade, setNewGrade] = useState({
    subject: '',
    assignment: '',
    taskId: '',
    grade: '',
    date: new Date().toISOString().split('T')[0],
    feedback: ''
  });

  // Sort enrolled students by roll number
  const enrolledStudents = students
    .filter(student => student.classId === classData.id || student.classIds?.includes(classData.id))
    .sort((a, b) => {
      // If both have roll numbers, sort numerically
      if (a.rollNumber && b.rollNumber) {
        return parseInt(a.rollNumber) - parseInt(b.rollNumber);
      }
      // If only one has a roll number, prioritize that one
      if (a.rollNumber) return -1;
      if (b.rollNumber) return 1;
      // Otherwise sort by name
      return a.name.localeCompare(b.name);
    });

  // Fetch streak and task data for all enrolled students
  useEffect(() => {
    const fetchAllStudentData = async () => {
      setIsLoadingStudentData(true);
      
      if (!accessToken) {
        setStudentsWithData(enrolledStudents);
        setIsLoadingStudentData(false);
        return;
      }

      if (enrolledStudents.length === 0) {
        setStudentsWithData([]);
        setIsLoadingStudentData(false);
        return;
      }

      try {
        // OPTIMIZED: Fetch all student data in one API call
        const studentEmails = enrolledStudents.map(s => s.email);
        
        const response = await fetch(
          `/api/teacher/students-batch-data`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ studentEmails })
          }
        );

        if (response.ok) {
          const result = await response.json();
          const studentsData = result.studentsData || {};

          const studentsWithEnhancedData = enrolledStudents.map(student => ({
            ...student,
            streakData: studentsData[student.email]?.streakData || { currentStreak: 0, longestStreak: 0, dates: [] },
            taskData: studentsData[student.email]?.taskData || { completedCount: 0, totalCount: 0 },
            averageGrade: Number.isFinite(Number(studentsData[student.email]?.averageGrade))
              ? Number(studentsData[student.email].averageGrade)
              : Number(student.averageGrade) || 0,
          }));

          setStudentsWithData(studentsWithEnhancedData);
        } else {
          console.error('Failed to fetch batch student data');
          setStudentsWithData(enrolledStudents);
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
        setStudentsWithData(enrolledStudents);
      } finally {
        setIsLoadingStudentData(false);
      }
    };

    if (enrolledStudents && enrolledStudents.length > 0) {
      fetchAllStudentData();
    } else {
      setStudentsWithData([]);
    }
  }, [enrolledStudents.length, accessToken, studentDataRefreshKey]);

  // Use studentsWithData instead of enrolledStudents for display
  const displayStudents = studentsWithData.length > 0 ? studentsWithData : enrolledStudents;

  const handleGradeDialogOpen = async (student) => {
    setSelectedStudent(student);
    setIsLoadingTasks(true);
    setIsGradeDialogOpen(true);
    
    console.log('=== FETCHING TASKS FROM BACKEND ===');
    console.log('Student:', student.name);
    console.log('Student email:', student.email);
    console.log('AccessToken exists:', !!accessToken);
    
    if (!accessToken) {
      console.error('ERROR: No accessToken provided to ClassView!');
      toast.error('Authentication error - please refresh the page');
      setIsLoadingTasks(false);
      return;
    }

    try {
      // Fetch student tasks from backend
      const url = `/api/teacher/student-tasks/${encodeURIComponent(student.email)}`;
      console.log('Fetching from URL:', url);
      console.log('Authorization header:', `Bearer ${accessToken.substring(0, 20)}...`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('Tasks fetched from backend:', data.tasks.length);
        setStudentAttemptedTasks(data.tasks || []);
        
        if (data.tasks.length === 0) {
          toast.info(`No tasks assigned to ${student.name} yet`);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch tasks:', errorData);
        console.error('Response status:', response.status);
        toast.error(`Failed to load student tasks: ${errorData.error || 'Unknown error'}`);
        setStudentAttemptedTasks([]);
      }
    } catch (error) {
      console.error('Error fetching student tasks:', error);
      toast.error('Failed to load student tasks');
      setStudentAttemptedTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
    
    console.log('=== END FETCH ===');
  };

  const handleTaskSelect = (taskId) => {
    const selectedTask = studentAttemptedTasks.find(t => t.id === taskId);
    if (selectedTask) {
      setNewGrade({
        ...newGrade,
        taskId: taskId,
        assignment: selectedTask.title,
        subject: selectedTask.subject || ''
      });
    }
  };

  const handleAddGrade = async () => {
    if (!newGrade.taskId || !newGrade.grade) {
      toast.error('Please select a task/quiz and assign a grade');
      return;
    }

    try {
      const response = await fetch('/api/teacher/task-grade', {
        method: 'POST',
        headers: {
          Authorization: ['Bearer', accessToken].join(' '),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: newGrade.taskId,
          studentEmail: selectedStudent.email,
          grade: Number(newGrade.grade),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Grade save failed (${response.status})`);
    } catch (error: any) {
      console.error('Error saving grade:', error);
      toast.error(error.message || 'Failed to save grade');
      return;
    }

    // Reset form
    setNewGrade({
      subject: '',
      assignment: '',
      taskId: '',
      grade: '',
      date: new Date().toISOString().split('T')[0],
      feedback: ''
    });
    setIsGradeDialogOpen(false);
    setStudentDataRefreshKey(previous => previous + 1);
    toast.success(`Grade added for ${selectedStudent.name}!`);
  };

  const averageProgress = displayStudents.length > 0
    ? Math.round(displayStudents.reduce((acc, s) => acc + (Number(s.gameProgress) || 0), 0) / displayStudents.length)
    : 0;
  
  const averageGrade = displayStudents.length > 0
    ? Math.round(displayStudents.reduce((acc, s) => acc + (Number(s.averageGrade) || 0), 0) / displayStudents.length)
    : 0;

  const availableStudents = students.filter(student =>
    student.email &&
    !(student.classId === classData.id || student.classIds?.includes(classData.id)),
  );
  const studentOptions = availableStudents.map(student => {
    const id = String(student.id || student.email);
    return {
      id,
      searchValue: [id, student.name, student.email, student.rollNumber]
        .filter(Boolean)
        .join(' '),
      student,
    };
  });

  const assignStudent = async () => {
    const student = studentOptions.find(option => option.id === studentToAssign)?.student;
    if (!student) return;
    setIsAssigning(true);
    try {
      const response = await fetch('/api/teacher/assign-student', {
        method: 'POST',
        headers: {
          Authorization: ['Bearer', accessToken].join(' '),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: student.id,
          studentEmail: student.email,
          classId: classData.id,
          className: classData.name,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to assign student');
      toast.success(`${student.name || student.email} assigned to ${classData.name}`);
      setIsAssignDialogOpen(false);
      setStudentToAssign('');
      onStudentAssigned?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign student');
    } finally {
      setIsAssigning(false);
    }
  };
  
  const getGradeColorByScore = (score: number) => {
    return score < 60 ? 'destructive' : 'secondary';
  };

  const handleGradeDialogClose = () => {
    setSelectedStudent(null);
    setIsGradeDialogOpen(false);
    setNewGrade({
      subject: '',
      assignment: '',
      taskId: '',
      grade: '',
      date: new Date().toISOString().split('T')[0],
      feedback: ''
    });
  };

  useEffect(() => {
    const title = `${classData.subject || classData.name} · ${classData.grade}`;
    const titleTimer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('dashboard-title-change', { detail: title }));
    }, 0);

    return () => {
      window.clearTimeout(titleTimer);
      window.dispatchEvent(new CustomEvent('dashboard-title-change', {
        detail: 'Class Details',
      }));
    };
  }, [classData.subject, classData.name, classData.grade]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Button
          onClick={onBack}
          variant="ghost"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Classes
        </Button>
        <div className="flex flex-wrap justify-end gap-3">
          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogTrigger render={<Button size="lg" />}>
              <UserPlus className="w-4 h-4 mr-2" />
              Assign Student
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign student to {classData.name}</DialogTitle>
                <DialogDescription>
                  Choose a student to add to this class. Students can belong to multiple classes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Combobox
                  items={studentOptions.map(option => option.searchValue)}
                  value={studentToAssign || null}
                  onValueChange={searchValue => {
                    const option = studentOptions.find(item => item.searchValue === searchValue);
                    setStudentToAssign(option?.id || '');
                  }}
                  itemToStringValue={searchValue => {
                    const student = studentOptions.find(
                      item => item.searchValue === searchValue,
                    )?.student;
                    return student
                      ? [student.name || student.email, student.email, student.rollNumber]
                          .filter(Boolean)
                          .join(' · ')
                      : searchValue;
                  }}
                >
                  <ComboboxInput
                    aria-label="Search students to assign"
                    placeholder="Search by name, email, or roll number"
                    className="w-full"
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No matching students found.</ComboboxEmpty>
                    <ComboboxList>
                      {(searchValue) => {
                        const student = studentOptions.find(
                          item => item.searchValue === searchValue,
                        )?.student;
                        if (!student) return null;
                        return (
                          <ComboboxItem key={searchValue} value={searchValue}>
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate">{student.name || student.email}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {[student.email, student.rollNumber].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                          </ComboboxItem>
                        );
                      }}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {!availableStudents.length && (
                  <p className="text-sm text-muted-foreground">All available students are already in this class.</p>
                )}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={assignStudent}
                  disabled={!studentToAssign || isAssigning}
                >
                  {isAssigning ? 'Assigning...' : 'Assign Student'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            size="lg"
            onClick={onAddQuiz}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Quiz
          </Button>
          <Button
            size="lg"
            onClick={onAddTask}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enrolled</p>
              <p className="text-lg font-semibold tabular-nums">
                {enrolledStudents.length}/{classData.capacity}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Target className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg. progress</p>
              <p className="text-lg font-semibold tabular-nums">{averageProgress}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Award className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg. grade</p>
              <p className="text-lg font-semibold tabular-nums">{averageGrade}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students List */}
      <div className="space-y-4">
        {enrolledStudents.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                <Users className="size-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium">No Students Enrolled</h3>
              <p className="text-muted-foreground">
                This class doesn't have any students yet. Add students to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          displayStudents.map(student => (
            <Card key={student.id} className="py-0">
              <CardContent className="p-4">
                <div className="flex flex-col gap-2 md:flex-row">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <RoleAvatar
                      role="student"
                      identifier={student.id || student.email}
                      name={student.name || 'Student'}
                      className="size-12 shrink-0"
                      fallbackClassName="text-base font-semibold"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-medium">{student.name}</h3>
                      <p className="truncate text-sm text-muted-foreground">{student.email}</p>
                    </div>
                    {onViewStudent && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10 shrink-0 rounded-full"
                        aria-label={`View ${student.name || 'student'} profile`}
                        title="View student profile"
                        onClick={() => onViewStudent(student)}
                      >
                        <Eye aria-hidden="true" className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 md:min-w-[34rem] md:grid-cols-5 md:gap-2">
                    <div className="text-center">
                      <div className="mb-1 flex items-center justify-center gap-1">
                        <GraduationCap className="size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Level</p>
                      </div>
                      <p className="text-lg font-semibold tabular-nums">{student.currentLevel}</p>
                    </div>
                    <div className="text-center">
                      <div className="mb-1 flex items-center justify-center gap-1">
                        <Award className="size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Points</p>
                      </div>
                      <p className="text-lg font-semibold tabular-nums">{student.totalPoints}</p>
                    </div>
                    <div className="text-center">
                      <div className="mb-1 flex items-center justify-center gap-1">
                        <BarChart3 className="size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Grade</p>
                      </div>
                      <Badge variant={getGradeColorByScore(student.averageGrade)} className="text-base">
                        {student.averageGrade}%
                      </Badge>
                    </div>
                    <div className="text-center">
                      <div className="mb-1 flex items-center justify-center gap-1">
                        <Flame className="size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Streak</p>
                      </div>
                      <p className="text-lg font-semibold tabular-nums">{student.streakData?.currentStreak || 0}</p>
                    </div>
                    <div className="text-center">
                      <div className="mb-1 flex items-center justify-center gap-1">
                        <CheckCircle2 className="size-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Tasks</p>
                      </div>
                      <p className="text-lg font-semibold tabular-nums">
                        {student.taskData?.completedCount || 0}/{student.taskData?.totalCount || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-1">
                  <span className="mb-1 block text-xs text-muted-foreground">Game Progress</span>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${student.gameProgress}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      {/* Grade Dialog */}
      <Dialog open={isGradeDialogOpen} onOpenChange={handleGradeDialogClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Add Grade for {selectedStudent?.name}
            </DialogTitle>
            <DialogDescription>
              Add a grade for the selected task/quiz.
            </DialogDescription>
          </DialogHeader>
          
          {studentAttemptedTasks.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <div className="mb-2 inline-flex size-16 items-center justify-center rounded-full bg-muted">
                <BookOpen className="size-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">No Tasks Assigned Yet</h3>
                <p className="text-muted-foreground text-sm">
                  {selectedStudent?.name} hasn't been assigned any tasks or quizzes yet.
                </p>
                <p className="text-muted-foreground text-sm mt-2">
                  Create tasks or quizzes for this class to start grading.
                </p>
              </div>
              <Button
                onClick={handleGradeDialogClose}
                variant="outline"
                className="mt-4"
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle className="w-4 h-4" />
                  <span><strong>{studentAttemptedTasks.length}</strong> task(s)/quiz(zes) assigned to student</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You can grade any task, including those not attempted (e.g., assign F for incomplete work)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task">Select Task/Quiz *</Label>
                <Select
                  value={newGrade.taskId}
                  onValueChange={handleTaskSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a task or quiz to grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentAttemptedTasks.map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        <div className="flex items-center gap-2">
                          {task.type === 'quiz' ? '📝' : '📋'} {task.title}
                          {task.completed && <Badge className="ml-2" variant="secondary">Completed</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newGrade.assignment && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected: <strong>{newGrade.assignment}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Select
                  value={newGrade.subject}
                  onValueChange={(value) => setNewGrade({ ...newGrade, subject: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {dentalSubjects.map(subject => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade">Letter Grade *</Label>
                <Select
                  value={newGrade.grade}
                  onValueChange={(value) => setNewGrade({ ...newGrade, grade: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {letterGrades.map(grade => (
                      <SelectItem key={grade.value} value={grade.percentage.toString()}>
                        <div className="flex items-center gap-3 py-1">
                          <span className="font-bold text-base w-8">{grade.label}</span>
                          <span className="text-muted-foreground text-sm">- {grade.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newGrade.date}
                  onChange={(e) => setNewGrade({ ...newGrade, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Feedback (Optional)</Label>
                <Textarea
                  id="feedback"
                  value={newGrade.feedback}
                  onChange={(e) => setNewGrade({ ...newGrade, feedback: e.target.value })}
                  placeholder="Add feedback for the student..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={handleGradeDialogClose}
                  variant="outline"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleAddGrade}

                  disabled={!newGrade.taskId || !newGrade.grade || !newGrade.subject}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Add Grade
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
