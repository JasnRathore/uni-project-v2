"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { RoleAvatar } from './RoleAvatar';
import { 
  ArrowLeft, 
  Users, 
  BookOpen, 
  Award, 
  TrendingUp, 
  User,
  Calendar,
  Target,
  BarChart3,
  GraduationCap,
  Plus,
  FileEdit,
  CheckCircle,
  XCircle,
  Flame,
  CheckCircle2,
  ListTodo
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
  accessToken: string;
  projectId: string;
}

export function ClassView({ classData, students, onBack, onAddTask, onAddQuiz, accessToken, projectId }: ClassViewProps) {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  const [studentAttemptedTasks, setStudentAttemptedTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [studentsWithData, setStudentsWithData] = useState<any[]>([]);
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
    .filter(student => student.classId === classData.id)
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
      
      if (!accessToken || !projectId) {
        console.error('Missing accessToken or projectId');
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
            taskData: studentsData[student.email]?.taskData || { completedCount: 0, totalCount: 0 }
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
  }, [enrolledStudents.length, accessToken, projectId]);

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
    console.log('ProjectId:', projectId);
    
    if (!accessToken) {
      console.error('ERROR: No accessToken provided to ClassView!');
      toast.error('Authentication error - please refresh the page');
      setIsLoadingTasks(false);
      return;
    }

    if (!projectId) {
      console.error('ERROR: No projectId provided to ClassView!');
      toast.error('Configuration error - please refresh the page');
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
    toast.success(`Grade added for ${selectedStudent.name}!`);
  };

  const averageProgress = displayStudents.length > 0
    ? Math.round(displayStudents.reduce((acc, s) => acc + s.gameProgress, 0) / displayStudents.length)
    : 0;
  
  const averageGrade = displayStudents.length > 0
    ? Math.round(displayStudents.reduce((acc, s) => acc + s.averageGrade, 0) / displayStudents.length)
    : 0;

  const activeStudents = displayStudents.filter(s => s.status === 'active').length;
  
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
        <div className="flex gap-3">
          <Button
            onClick={onAddQuiz}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Quiz
          </Button>
          <Button
            size="sm"
            onClick={onAddTask}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Class Header */}
      <Card className="mb-6">
        <CardContent className="flex flex-col justify-between gap-6 p-6 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <BookOpen className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold tracking-tight">{classData.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{classData.subject}</p>
              </div>
            </div>
            <Badge variant="secondary">{classData.grade}</Badge>
            {classData.description && (
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{classData.description}</p>
            )}
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3">
            <div className="min-w-32 rounded-lg border bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                <span>Enrolled</span>
              </div>
              <p className="text-xl font-semibold tabular-nums">{enrolledStudents.length}/{classData.capacity}</p>
            </div>
            <div className="min-w-32 rounded-lg border bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="size-4" />
                <span>Active</span>
              </div>
              <p className="text-xl font-semibold tabular-nums">{activeStudents}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards - REMOVED Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Average Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-3xl font-semibold tabular-nums text-foreground">{averageProgress}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-muted-foreground" />
              Average Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-3xl font-semibold tabular-nums text-foreground">{averageGrade}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-3xl font-semibold tabular-nums text-foreground">
              {Math.round((enrolledStudents.length / classData.capacity) * 100)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students List */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="all">
            All Students ({enrolledStudents.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeStudents})
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive ({enrolledStudents.length - activeStudents})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {enrolledStudents.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Students Enrolled</h3>
                <p className="text-muted-foreground">
                  This class doesn't have any students yet. Add students to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            displayStudents.map((student) => (
              <Card key={student.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Student Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <RoleAvatar
                        role="student"
                        identifier={student.id || student.email}
                        name={student.name || 'Student'}
                        className="size-16 shadow-lg"
                        fallbackClassName="text-xl font-semibold"
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-medium mb-1">{student.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{student.email}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                            {student.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            {student.lastActive}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Student Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <GraduationCap className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Level</p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-foreground">{student.currentLevel}</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Award className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Points</p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-foreground">{student.totalPoints}</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Target className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Progress</p>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <p className="text-xl font-semibold tabular-nums text-foreground">{student.gameProgress}%</p>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <BarChart3 className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Grade</p>
                        </div>
                        <Badge variant={getGradeColorByScore(student.averageGrade)} className="text-lg">
                          {student.averageGrade}%
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Game Progress</span>
                      <span className="text-xs font-medium">{student.gameProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div 
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${student.gameProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Streak and Task Completion */}
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border bg-muted/50 p-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Flame className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Current Streak</span>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums text-foreground">
                        {student.streakData?.currentStreak || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Tasks Completed</span>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums text-foreground">
                        {student.taskData?.completedCount || 0}<span className="text-lg text-muted-foreground">/{student.taskData?.totalCount || 0}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {student.taskData?.totalCount > 0 
                          ? `${Math.round((student.taskData.completedCount / student.taskData.totalCount) * 100)}% complete`
                          : 'No tasks assigned'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Add Grade Button */}
                  <div className="mt-4 border-t pt-4">
                    <Button
                      onClick={() => handleGradeDialogOpen(student)}
                      variant="outline"
                      className="w-full"
                    >
                      <FileEdit className="w-4 h-4 mr-2" />
                      Add/Upload Grade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {enrolledStudents.filter(s => s.status === 'active').length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Active Students</h3>
                <p className="text-muted-foreground">
                  There are no active students in this class.
                </p>
              </CardContent>
            </Card>
          ) : (
            enrolledStudents.filter(s => s.status === 'active').map((student) => (
              <Card key={student.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <RoleAvatar
                        role="student"
                        identifier={student.id || student.email}
                        name={student.name || 'Student'}
                        className="size-16 shadow-lg"
                        fallbackClassName="text-xl font-semibold"
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-medium mb-1">{student.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{student.email}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="default">🟢 Active</Badge>
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            {student.lastActive}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <GraduationCap className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Level</p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-foreground">{student.currentLevel}</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Award className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Points</p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-foreground">{student.totalPoints}</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Target className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Progress</p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-foreground">{student.gameProgress}%</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <BarChart3 className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Grade</p>
                        </div>
                        <Badge variant={getGradeColorByScore(student.averageGrade)} className="text-lg">
                          {student.averageGrade}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Game Progress</span>
                      <span className="text-xs font-medium">{student.gameProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div 
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${student.gameProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Add Grade Button */}
                  <div className="mt-4 border-t pt-4">
                    <Button
                      onClick={() => handleGradeDialogOpen(student)}
                      variant="outline"
                      className="w-full"
                    >
                      <FileEdit className="w-4 h-4 mr-2" />
                      Add/Upload Grade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="inactive" className="space-y-4">
          {enrolledStudents.filter(s => s.status === 'inactive').length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Inactive Students</h3>
                <p className="text-muted-foreground">
                  All students in this class are currently active!
                </p>
              </CardContent>
            </Card>
          ) : (
            enrolledStudents.filter(s => s.status === 'inactive').map((student) => (
              <Card key={student.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <RoleAvatar
                        role="student"
                        identifier={student.id || student.email}
                        name={student.name || 'Student'}
                        className="size-16 shadow-lg"
                        fallbackClassName="text-xl font-semibold"
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-medium mb-1">{student.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{student.email}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">🔴 Inactive</Badge>
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            {student.lastActive}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <GraduationCap className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Level</p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-foreground">{student.currentLevel}</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Award className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Points</p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-foreground">{student.totalPoints}</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Target className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Progress</p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-foreground">{student.gameProgress}%</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <BarChart3 className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Grade</p>
                        </div>
                        <Badge variant={getGradeColorByScore(student.averageGrade)} className="text-lg">
                          {student.averageGrade}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Game Progress</span>
                      <span className="text-xs font-medium">{student.gameProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div 
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${student.gameProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Add Grade Button */}
                  <div className="mt-4 border-t pt-4">
                    <Button
                      onClick={() => handleGradeDialogOpen(student)}
                      variant="outline"
                      className="w-full"
                    >
                      <FileEdit className="w-4 h-4 mr-2" />
                      Add/Upload Grade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

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
