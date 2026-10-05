"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { StudentsList } from './StudentsList';
import { StudentProfile } from './StudentProfile';
import { MarksManagement } from './MarksManagement';
import { AddStudent } from './AddStudent';
import { ClassManagement } from './ClassManagement';
import { ClassView } from './ClassView';
import { AddQuiz } from './AddQuiz';
import { TasksAndQuizzesManagement } from './TasksAndQuizzesManagement';
import { TaskSubmissionsPage } from './TaskSubmissionsPage';
import { EditTask } from './EditTask';
import { Settings } from './Settings';
import { AssignStudent } from './AssignStudent';
import { RoleAvatar } from './RoleAvatar';
import { DebugPanel } from './DebugPanel';
import { AddDailyTask } from './AddDailyTask';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  School,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from './utils/supabase/info';

interface AdminDashboardProps {
  currentUser: any;
  onLogout: () => void;
  accessToken: string;
}

export function AdminDashboard({ currentUser: initialUser, onLogout, accessToken }: AdminDashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(initialUser);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const dashboardSegments = pathname.slice('/admin/dashboard'.length).split('/').filter(Boolean);
  const activeView = dashboardSegments[0] || 'dashboard';
  const detailId = dashboardSegments[1]
    ? decodeURIComponent(dashboardSegments[1])
    : null;
  const setActiveView = (view: string, id?: string | number) => {
    const selectedId = id ?? (
      view === 'class-view' || view === 'add-task' || view === 'add-quiz'
        ? selectedClass?.id
        : view === 'edit-task'
          ? selectedTask?.id
          : view === 'profile' || view === 'assign-student'
            ? selectedStudent?.email || selectedStudent?.id
            : undefined
    );
    const route = view === 'dashboard'
      ? '/admin/dashboard'
      : `/admin/dashboard/${view}${selectedId ? `/${encodeURIComponent(String(selectedId))}` : ''}`;
    router.push(route);
  };
  const [tasks, setTasks] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState<any[]>([]);
  const [isLoadingRegisteredStudents, setIsLoadingRegisteredStudents] = useState(true);

  // Load data from backend on mount
  useEffect(() => {
    if (accessToken) {
      loadTeacherData();
      loadRegisteredStudents();
    }
  }, [accessToken]);

  useEffect(() => {
    if (!detailId) return;

    if (activeView === 'class-view' || activeView === 'add-task' || activeView === 'add-quiz') {
      setSelectedClass(classes.find(item => String(item.id) === detailId) || null);
    } else if (activeView === 'edit-task' || activeView === 'task-submissions') {
      setSelectedTask(tasks.find(item => String(item.id) === detailId) || null);
    } else if (activeView === 'profile' || activeView === 'assign-student') {
      const allStudents = [...registeredStudents, ...students];
      setSelectedStudent(allStudents.find(item =>
        String(item.id) === detailId ||
        String(item.email).toLowerCase() === detailId.toLowerCase()
      ) || null);
    }
  }, [activeView, classes, detailId, registeredStudents, students, tasks]);

  // Save students to backend whenever they change
  useEffect(() => {
    if (hasLoadedData) {
      saveStudents();
    }
  }, [students, hasLoadedData]);

  // Save classes to backend whenever they change
  useEffect(() => {
    if (hasLoadedData) {
      saveClasses();
    }
  }, [classes, hasLoadedData]);

  const loadTeacherData = async () => {
    setHasLoadedData(false);
    try {
      const response = await fetch(`/api/teacher/data`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
        setClasses(data.classes || []);
        setTasks(data.tasks || []);
        setHasLoadedData(true);
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || `Failed to load teacher data (${response.status})`);
        setStudents([]);
        setClasses([]);
        setTasks([]);
      }
    } catch (error) {
      console.error('Error loading teacher data:', error);
      toast.error('Failed to load data');
      setStudents([]);
      setClasses([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadRegisteredStudents = async () => {
    setIsLoadingRegisteredStudents(true);
    try {
      console.log('Loading registered students with token:', accessToken ? 'Token present' : 'NO TOKEN');
      const response = await fetch(`/api/teacher/all-students`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Registered students loaded:', data.students?.length || 0, 'students');
        console.log('Students data:', data.students);
        setRegisteredStudents(data.students || []);
      } else {
        const errorData = await response.json();
        console.error('Failed to load students:', errorData);
        toast.error('Failed to load students: ' + (errorData.error || 'Unknown error'));
        setRegisteredStudents([]);
      }
    } catch (error) {
      console.error('Error loading registered students:', error);
      toast.error('Failed to load registered students');
      setRegisteredStudents([]);
    } finally {
      setIsLoadingRegisteredStudents(false);
    }
  };

  const saveStudents = async () => {
    try {
      const response = await fetch(`/api/teacher/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ students })
      });
      if (!response.ok) throw new Error(`Save students failed (${response.status})`);
    } catch (error) {
      console.error('Error saving students:', error);
      toast.error('Failed to save students');
    }
  };

  const saveClasses = async () => {
    try {
      const response = await fetch(`/api/teacher/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ classes })
      });
      if (!response.ok) throw new Error(`Save classes failed (${response.status})`);
    } catch (error) {
      console.error('Error saving classes:', error);
      toast.error('Failed to save classes');
    }
  };

  const saveTasks = async (tasks: any[]) => {
    try {
      await fetch(`/api/teacher/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ tasks })
      });
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  };

  const getDefaultStudents = () => [
    {
      id: 1,
      name: "Priya Sharma",
      email: "priya.sharma@dentalcollege.edu",
      avatar: "PS",
      currentLevel: 15,
      totalPoints: 2450,
      gameProgress: 78,
      lastActive: "2 hours ago",
      status: "active",
      subjects: ["Oral Pathology", "Periodontology"],
      averageGrade: 92,
      classId: "class-1",
      className: "Oral Pathology - BDS 3rd Year"
    },
    {
      id: 2,
      name: "Rajesh Kumar",
      email: "rajesh.kumar@dentalcollege.edu",
      avatar: "RK",
      currentLevel: 12,
      totalPoints: 1890,
      gameProgress: 65,
      lastActive: "1 day ago",
      status: "active",
      subjects: ["Conservative Dentistry", "Endodontics"],
      averageGrade: 85,
      classId: "class-2",
      className: "Conservative Dentistry - BDS 4th Year"
    },
    {
      id: 3,
      name: "Sneha Patel",
      email: "sneha.patel@dentalcollege.edu",
      avatar: "SP",
      currentLevel: 18,
      totalPoints: 3200,
      gameProgress: 89,
      lastActive: "30 minutes ago",
      status: "active",
      subjects: ["Orthodontics", "Oral Surgery"],
      averageGrade: 96,
      classId: "class-3",
      className: "Orthodontics - MDS 1st Year"
    },
    {
      id: 4,
      name: "Arjun Singh",
      email: "arjun.singh@dentalcollege.edu",
      avatar: "AS",
      currentLevel: 8,
      totalPoints: 1200,
      gameProgress: 45,
      lastActive: "3 days ago",
      status: "inactive",
      subjects: ["Oral Anatomy", "Dental Materials"],
      averageGrade: 78,
      classId: "class-4",
      className: "Oral Anatomy - BDS 1st Year"
    },
    {
      id: 5,
      name: "Kavya Reddy",
      email: "kavya.reddy@dentalcollege.edu",
      avatar: "KR",
      currentLevel: 20,
      totalPoints: 4100,
      gameProgress: 95,
      lastActive: "1 hour ago",
      status: "active",
      subjects: ["Prosthodontics", "Oral Medicine"],
      averageGrade: 98,
      classId: "class-5",
      className: "Prosthodontics - BDS 5th Year"
    },
    {
      id: 6,
      name: "Vikram Jain",
      email: "vikram.jain@dentalcollege.edu",
      avatar: "VJ",
      currentLevel: 14,
      totalPoints: 2100,
      gameProgress: 72,
      lastActive: "4 hours ago",
      status: "active",
      subjects: ["Pedodontics", "Community Dentistry"],
      averageGrade: 88,
      classId: "class-6",
      className: "Pedodontics - BDS 4th Year"
    }
  ];

  const getDefaultClasses = () => [];

  const handleAddStudent = async (newStudent: any) => {
    if (allStudents.some(student => student.email?.toLowerCase() === newStudent.email?.toLowerCase())) {
      throw new Error('A student with this email already exists.');
    }

    const nextStudents = [...students, newStudent];
    const response = await fetch('/api/teacher/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ['Bearer', accessToken].join(' '),
      },
      body: JSON.stringify({ students: nextStudents }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Failed to save student (${response.status})`);
    }

    setStudents(nextStudents);
    // Update class student count
    setClasses((prev: any[]) => prev.map((cls: any) => 
      cls.id === newStudent.classId 
        ? { ...cls, studentCount: (Number(cls.studentCount) || 0) + 1 }
        : cls
    ));
  };

  const handleAddClass = (newClass: any) => {
    if (classes.some(classItem => classItem.id === newClass.id)) {
      toast.error('This curriculum class has already been added.');
      return false;
    }
    setClasses(prev => [...prev, newClass]);
    return true;
  };

  const handleViewClass = (classToView: any) => {
    // Calculate actual student count for this class
    // Count manual students in this class
    const manualStudentCount = students.filter((s: any) => s.classId === classToView.id).length;
    // Count registered students assigned to this class
    const registeredStudentCount = registeredStudents.filter((s: any) => s.classId === classToView.id).length;
    // Total students
    const totalStudents = manualStudentCount + registeredStudentCount;
    
    setSelectedClass({
      ...classToView,
      studentCount: totalStudents
    });
    setActiveView('class-view', classToView.id);
  };

  const handleAddTask = (newTask: any) => {
    setTasks(prev => [newTask, ...prev]);
    setActiveView('class-view');
  };

  const handleEditTask = (task: any) => {
    setSelectedTask(task);
    setActiveView('edit-task', task.id);
  };

  const handleSaveTask = async (updatedTask: any) => {
    try {
      const response = await fetch(`/api/teacher/tasks/${encodeURIComponent(updatedTask.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', accessToken].join(' '),
        },
        body: JSON.stringify(updatedTask)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Update failed (${response.status})`);
      setTasks(prev => prev.map(task => task.id === updatedTask.id ? data.task : task));
      setActiveView('tasks-quizzes');
      toast.success('Task/Quiz updated successfully');
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error(error.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: any): Promise<boolean> => {
    if (!confirm('Are you sure you want to delete this task/quiz?')) return false;
    try {
      const response = await fetch(`/api/teacher/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
        headers: { Authorization: ['Bearer', accessToken].join(' ') }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Delete failed (${response.status})`);
      if (data.success !== true) throw new Error('The server did not confirm task deletion');
      setTasks(prev => prev.filter(task => task.id !== taskId));
      toast.success('Task/Quiz deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast.error(error.message || 'Failed to delete task');
      return false;
    }
  };

  const handleUpdateProfile = async (profileData: any) => {
    try {
      const response = await fetch(
        `/api/teacher/profile/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(profileData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCurrentUser((prev: any) => ({
          ...prev,
          ...data.profile
        }));
      } else {
        const errorData = await response.json();
        console.error('Failed to update profile:', errorData);
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const handleUpdateStudentClass = (studentId: any, newClassId: any, newClassName: any) => {
    // Get the student's old class ID before updating
    const student = students.find(s => s.id === studentId);
    const oldClassId = student.classId;
    
    // Update student's class
    setStudents(prev => prev.map(s => 
      s.id === studentId 
        ? { ...s, classId: newClassId, className: newClassName }
        : s
    ));

    // Update selected student if we're viewing their profile
    if (selectedStudent && selectedStudent.id === studentId) {
      setSelectedStudent((prev: any) => ({
        ...prev,
        classId: newClassId,
        className: newClassName
      }));
    }

    // Update class student counts
    setClasses(prev => prev.map(cls => {
      if (cls.id === oldClassId) {
        return { ...cls, studentCount: cls.studentCount - 1 };
      }
      if (cls.id === newClassId) {
        return { ...cls, studentCount: cls.studentCount + 1 };
      }
      return cls;
    }));

    // Update selected class if we're currently viewing one
    if (selectedClass) {
      setSelectedClass((prev: any) => {
        if (prev.id === oldClassId) {
          return { ...prev, studentCount: prev.studentCount - 1 };
        }
        if (prev.id === newClassId) {
          return { ...prev, studentCount: prev.studentCount + 1 };
        }
        return prev;
      });
    }
  };

  const handleDeleteClass = async (classId: any) => {
    // Check if class has students
    const classStudents = [
      ...students,
      ...registeredStudents.filter(student => student.isAssigned),
    ].filter(student => student.classId === classId);
    if (classStudents.length > 0) {
      toast.error('Cannot delete class with enrolled students');
      return;
    }
    try {
      const response = await fetch(`/api/teacher/classes/${encodeURIComponent(classId)}`, {
        method: 'DELETE',
        headers: { Authorization: ['Bearer', accessToken].join(' ') }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Delete failed (${response.status})`);
      setClasses(prev => prev.filter(cls => cls.id !== classId));
      toast.success('Class deleted successfully');
    } catch (error: any) {
      console.error('Error deleting class:', error);
      toast.error(error.message || 'Failed to delete class');
    }
  };

  // Registered portal records take precedence when an email appears in both data sources.
  const allStudents = useMemo(() => {
    const teacherEmail = currentUser?.email?.toLowerCase();
    const emailsSeen = new Set<string>();
    return [...registeredStudents, ...students]
      .filter(s => {
        if (!s?.email) return false;
        const email = s.email.toLowerCase();
        if (email === teacherEmail) return false;
        if (s.role === 'teacher' || s.isTeacher) return false;
        if (emailsSeen.has(email)) return false;
        emailsSeen.add(email);
        return true;
      });
  }, [registeredStudents, students, currentUser?.email]);

  const renderContent = () => {
    switch (activeView) {
      case 'students':
      case 'portal-students':
        return (
          <StudentsList
            key={activeView}
            accessToken={accessToken}
            onSelectStudent={(student) => {
              setSelectedStudent(student);
              if (student.isRegistered) {
                setActiveView('assign-student', student.email || student.id);
              } else {
                setActiveView('profile', student.email || student.id);
              }
            }}
            students={allStudents}
            classes={classes}
            onRefresh={loadRegisteredStudents}
            onAddStudent={handleAddStudent}
            initialRegistrationFilter={activeView === 'portal-students' ? 'portal' : 'all'}
          />
        );
      case 'profile':
        return (
          <StudentProfile 
            student={selectedStudent}
            onBack={() => setActiveView('students')}
            accessToken={accessToken}
            projectId={projectId}
            isTeacherEditing
            onUpdate={(updatedStudent: any) => {
              setStudents(prev => prev.map(student =>
                student.id === selectedStudent.id ? { ...student, ...updatedStudent } : student
              ));
              setActiveView('dashboard');
            }}
          />
        );
      case 'assign-student':
        if (!selectedStudent) {
          const isResolvingStudent = isLoadingData || isLoadingRegisteredStudents;
          return (
            <div className="p-6">
              <p className="text-muted-foreground">
                {isResolvingStudent ? 'Loading student...' : 'This student could not be found.'}
              </p>
              {!isResolvingStudent && (
                <Button className="mt-4" onClick={() => setActiveView('students')}>
                  Back to Students
                </Button>
              )}
            </div>
          );
        }
        return (
          <AssignStudent
            student={selectedStudent}
            classes={classes}
            onBack={() => setActiveView('students')}
            onAssignSuccess={() => {
              loadRegisteredStudents();
            }}
            accessToken={accessToken}
          />
        );
      case 'classes':
        return (
          <ClassManagement
            classes={classes}
            students={allStudents}
            onAddClass={handleAddClass}
            onViewClass={handleViewClass}
            onDeleteClass={handleDeleteClass}
          />
        );
      case 'class-view':
        if (!selectedClass) {
          return (
            <div className="p-6">
              <p className="text-muted-foreground">
                {isLoadingData ? 'Loading class...' : 'This class could not be found.'}
              </p>
              {!isLoadingData && (
                <Button className="mt-4" onClick={() => setActiveView('classes')}>
                  Back to Classes
                </Button>
              )}
            </div>
          );
        }
        return (
          <ClassView
            classData={selectedClass}
            students={allStudents}
            onBack={() => setActiveView('classes')}
            onAddTask={() => setActiveView('add-task')}
            onAddQuiz={() => setActiveView('add-quiz')}
            accessToken={accessToken}
            projectId={projectId}
          />
        );
      case 'add-task':
        return (
          <AddDailyTask
            selectedClass={selectedClass}
            classes={classes}
            students={allStudents}
            accessToken={accessToken}
            onBack={() => setActiveView(selectedClass ? 'class-view' : 'dashboard')}
            onTaskCreated={(newTask) => {
              setTasks(prev => [newTask, ...prev]);
            }}
          />
        );
      case 'add-quiz':
        if (!selectedClass) {
          return (
            <div className="p-6">
              <p className="text-muted-foreground">
                {isLoadingData ? 'Loading class...' : 'Select a class before creating a quiz.'}
              </p>
              {!isLoadingData && (
                <Button className="mt-4" onClick={() => setActiveView('classes')}>
                  Back to Classes
                </Button>
              )}
            </div>
          );
        }
        return (
          <AddQuiz
            classData={selectedClass}
            students={allStudents}
            accessToken={accessToken}
            onBack={() => setActiveView('class-view')}
            onAddQuiz={handleAddTask}
          />
        );
      case 'edit-task':
        return (
          <EditTask
            task={selectedTask}
            onBack={() => setActiveView('tasks-quizzes')}
            onSave={handleSaveTask}
          />
        );
      case 'task-submissions':
        if (!selectedTask) {
          return (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
              <p className="text-muted-foreground">
                {isLoadingData ? 'Loading task...' : 'The requested task could not be found.'}
              </p>
              {!isLoadingData && (
                <Button className="w-fit" onClick={() => setActiveView('tasks-quizzes')}>
                  Back to tasks and quizzes
                </Button>
              )}
            </div>
          );
        }
        return (
          <TaskSubmissionsPage
            task={selectedTask}
            accessToken={accessToken}
            onBack={() => setActiveView('tasks-quizzes')}
          />
        );
      case 'tasks-quizzes':
        return (
          <TasksAndQuizzesManagement
            tasks={tasks}
            classes={classes}
            students={allStudents}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onCreateTask={newTask => setTasks(prev => [newTask, ...prev])}
            onManageStudents={task => setActiveView('task-submissions', task.id)}
            accessToken={accessToken}
          />
        );
      case 'add-student':
        return (
          <AddStudent
            onBack={() => setActiveView('students')}
            classes={classes}
            onAddStudent={handleAddStudent}
          />
        );
      case 'grades':
      case 'marks':
        return <MarksManagement students={allStudents} classes={classes} accessToken={accessToken} projectId={projectId} />;
      case 'settings':
        return <Settings currentUser={currentUser} accessToken={accessToken} onLogout={onLogout} onUpdateProfile={handleUpdateProfile} />;
      case 'debug':
        return <DebugPanel accessToken={accessToken} />;
      default:
        return (
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 sm:p-6 lg:p-8">
            <section aria-labelledby="overview-heading">
              <h2 id="overview-heading" className="text-2xl font-semibold tracking-tight">
                {currentUser?.name ? `Welcome back, Dr. ${currentUser.name}` : 'Overview'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A summary of your classes and student records.
              </p>
            </section>

            <section aria-label="Workspace totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Students', value: allStudents.length, icon: Users },
                { label: 'Portal accounts', value: registeredStudents.length, icon: GraduationCap },
                { label: 'Classes', value: classes.length, icon: School },
                { label: 'Tasks and quizzes', value: tasks.length, icon: BookOpen },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label} className="shadow-none">
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
                    </div>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Icon aria-hidden="true" className="size-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Students on record</CardTitle>
                  <CardDescription>
                    {allStudents.length
                      ? 'A sample of student records from your workspace.'
                      : 'Students you add or assign will appear here.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {allStudents.length ? (
                    <ul className="divide-y">
                      {allStudents.slice(0, 5).map(student => (
                        <li key={student.email || student.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(student);
                              setActiveView(
                                student.isRegistered ? 'assign-student' : 'profile',
                                student.email || student.id,
                              );
                            }}
                            className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <RoleAvatar
                              role="student"
                              identifier={student.id || student.email}
                              name={student.name || 'Student'}
                              className="size-9"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{student.name || 'Unnamed student'}</span>
                              <span className="block truncate text-xs text-muted-foreground">{student.email}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
                      No student records yet. Add a student or invite an existing portal account.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Quick actions</CardTitle>
                  <CardDescription>Add a roster student. Other destinations are in the sidebar.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Button className="justify-start" onClick={() => setActiveView('add-student')}>
                    <Users aria-hidden="true" />
                    Add a student
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 size-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  return <div className="min-h-full">{renderContent()}</div>;
}
