"use client";
import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { StudentsList } from './StudentsList';
import { StudentProfile } from './StudentProfile';
import { MarksManagement } from './MarksManagement';
import { AddStudent } from './AddStudent';
import { AddClass } from './AddClass';
import { ClassManagement } from './ClassManagement';
import { ClassView } from './ClassView';
import { AddTask } from './AddTask';
import { AddQuiz } from './AddQuiz';
import { TasksAndQuizzesManagement } from './TasksAndQuizzesManagement';
import { EditTask } from './EditTask';
import { Settings } from './Settings';
import { AssignStudent } from './AssignStudent';
import { RegisteredStudentsList } from './RegisteredStudentsList';
import { DebugPanel } from './DebugPanel';
import { AddDailyTask } from './AddDailyTask';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  School,
  Plus,
  Sparkles
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
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
    } else if (activeView === 'edit-task') {
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

  const handleAddStudent = (newStudent: any) => {
    setStudents(prev => [...prev, newStudent]);
    // Update class student count
    setClasses((prev: any[]) => prev.map((cls: any) => 
      cls.id === newStudent.classId 
        ? { ...cls, studentCount: cls.studentCount + 1 }
        : cls
    ));
    setActiveView('students');
  };

  const handleAddClass = (newClass: any) => {
    setClasses(prev => [...prev, newClass]);
    setActiveView('classes');
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

  const [selectedBatch, setSelectedBatch] = useState('All');
  const [selectedClassName, setSelectedClassName] = useState('All');

  const renderContent = () => {
    // Combine manually added students with registered students, deduplicating by email.
    // Registered portal students take precedence (more reliable data).
    // Filter out the teacher/admin account.
    const teacherEmail = currentUser?.email?.toLowerCase();
    const emailsSeen = new Set();
    const allStudents = [...registeredStudents, ...students]
      .filter(s => {
        if (!s?.email) return false;
        const email = s.email.toLowerCase();
        if (email === teacherEmail) return false;
        if (s.role === 'teacher' || s.isTeacher) return false;
        if (emailsSeen.has(email)) return false;
        emailsSeen.add(email);
        return true;
      });

    const filteredStudents = allStudents.filter(student => {
      const batchMatch = selectedBatch === 'All' || student.batch === selectedBatch;
      const className = student.className || student.class;
      const classMatch = selectedClassName === 'All' || className === selectedClassName;
      return batchMatch && classMatch;
    });
    
    switch (activeView) {
      case 'students':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Filter by Batch</Label>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Batch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Batches</SelectItem>
                    <SelectItem value="I BDS">I BDS</SelectItem>
                    <SelectItem value="II BDS">II BDS</SelectItem>
                    <SelectItem value="III BDS">III BDS</SelectItem>
                    <SelectItem value="IV BDS">IV BDS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Filter by Class</Label>
                <Select value={selectedClassName} onValueChange={setSelectedClassName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Classes</SelectItem>
                    <SelectItem value="Oral Anatomy">Oral Anatomy</SelectItem>
                    <SelectItem value="Dental Materials">Dental Materials</SelectItem>
                    <SelectItem value="Oral Pathology">Oral Pathology</SelectItem>
                    <SelectItem value="Pharmacology">Pharmacology</SelectItem>
                    <SelectItem value="General Surgery">General Surgery</SelectItem>
                    <SelectItem value="General Medicine">General Medicine</SelectItem>
                    <SelectItem value="Oral Surgery">Oral Surgery</SelectItem>
                    <SelectItem value="Prosthodontics">Prosthodontics</SelectItem>
                    <SelectItem value="Orthodontics">Orthodontics</SelectItem>
                    <SelectItem value="Periodontics">Periodontics</SelectItem>
                    <SelectItem value="Pedodontics">Pedodontics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <StudentsList 
              accessToken={accessToken}
              onSelectStudent={(student) => {
                setSelectedStudent(student);
                // Route portal students to assign view
                if (student.isRegistered) {
                  setActiveView('assign-student', student.email || student.id);
                } else {
                  setActiveView('profile', student.email || student.id);
                }
              }}
              students={filteredStudents}
              classes={classes}
              onRefresh={loadRegisteredStudents}
            />
          </div>
        );
      case 'portal-students':
        return (
          <RegisteredStudentsList
            students={filteredStudents}
            onBack={() => setActiveView('dashboard')}
            onSelectStudent={(student: any) => {
              setSelectedStudent(student);
              setActiveView('assign-student', student.email || student.id);
            }}
            accessToken={accessToken}
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
            onAddClass={() => setActiveView('add-class')}
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
      case 'tasks-quizzes':
        return (
          <TasksAndQuizzesManagement
            tasks={tasks}
            classes={classes}
            students={allStudents}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
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
      case 'add-class':
        return (
          <AddClass
            onBack={() => setActiveView('classes')}
            onAddClass={handleAddClass}
          />
        );
      case 'marks':
        return <MarksManagement students={allStudents} classes={classes} accessToken={accessToken} projectId={projectId} />;
      case 'settings':
        return <Settings currentUser={currentUser} accessToken={accessToken} onLogout={onLogout} onUpdateProfile={handleUpdateProfile} />;
      case 'debug':
        return <DebugPanel accessToken={accessToken} />;
      default:
        return (
          <div className="p-6">
            <div className="mb-6 p-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-2xl text-white shadow-xl">
              <h1 className="mb-2 text-2xl">Welcome back, Dr. {currentUser.name}! 🦷</h1>
              <p className="text-white/90">
                Ready to guide your dental students through their clinical and academic journey today.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl border-0 text-white shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white/90">Total Students</h3>
                </div>
                <p className="text-3xl font-bold">{allStudents.length}</p>
                {registeredStudents.length > 0 && (
                  <p className="text-xs text-white/70 mt-1">
                    {registeredStudents.length} registered via portal
                  </p>
                )}
              </div>
              <div className="p-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl border-0 text-white shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <School className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white/90">Total Classes</h3>
                </div>
                <p className="text-3xl font-bold">{classes.length}</p>
              </div>
              <div className="p-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl border-0 text-white shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white/90">Active Students</h3>
                </div>
                <p className="text-3xl font-bold">{allStudents.filter(s => s.status === 'active').length}</p>
              </div>
              <div className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl border-0 text-white shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white/90">Average Progress</h3>
                </div>
                <p className="text-3xl font-bold">
                  {allStudents.length > 0 
                    ? Math.round(allStudents.reduce((acc, s) => acc + s.gameProgress, 0) / allStudents.length)
                    : 0
                  }%
                </p>
              </div>
            </div>
            
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl border shadow-lg">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <School className="w-5 h-5 text-blue-600" />
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <Button 
                    onClick={() => setActiveView('students')}
                    className="w-full justify-start bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white border-0"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    View All Students
                  </Button>
                  <Button 
                    onClick={() => setActiveView('add-class')}
                    className="w-full justify-start bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Class
                  </Button>
                  <Button 
                    onClick={() => setActiveView('marks')}
                    className="w-full justify-start bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Manage Marks
                  </Button>
                  <Button 
                    onClick={() => setActiveView("add-task")}
                    className="w-full justify-start bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Assign Task
                  </Button>
                </div>
              </div>
              
              <div className="p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl border shadow-lg">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {allStudents
                    .filter(s => s.status === 'active')
                    .slice(0, 3)
                    .map(student => (
                      <div key={student.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {student.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.lastActive}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  return <div className="min-h-full">{renderContent()}</div>;
}
