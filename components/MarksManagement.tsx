"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { KpiCard } from './ui/kpi-card';
import { 
  Plus, 
  Edit, 
  Save, 
  Search,
  Filter,
  FileSpreadsheet,
  GraduationCap,
  BookOpen,
  UserPlus
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

export function MarksManagement({ students, classes, accessToken, projectId }: { students: any[]; classes: any[]; accessToken: string; projectId: string }) {
  const [grades, setGrades] = useState<any[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newGrade, setNewGrade] = useState({
    studentId: '',
    classId: '',
    subject: '',
    assignment: '',
    grade: '',
    date: new Date().toISOString().split('T')[0],
    feedback: ''
  });

  useEffect(() => {
    const loadGrades = async () => {
      setIsLoadingGrades(true);
      try {
        const response = await fetch('/api/teacher/data', {
          headers: { Authorization: ['Bearer', accessToken].join(' ') }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Failed to load grades (${response.status})`);
        setGrades(Array.isArray(data.grades) ? data.grades : []);
      } catch (error: any) {
        console.error('Error loading grades:', error);
        toast.error(error.message || 'Failed to load grades');
      } finally {
        setIsLoadingGrades(false);
      }
    };
    if (accessToken && projectId) loadGrades();
    else setIsLoadingGrades(false);
  }, [accessToken, projectId]);

  const syncGradesToBackend = async () => {
    if (!accessToken || !projectId) return;
    
    try {
      const response = await fetch(
        `/api/teacher/grades`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ grades })
        }
      );
      
      if (!response.ok) {
        console.error('Failed to sync grades to backend');
      }
    } catch (error) {
      console.error('Error syncing grades:', error);
    }
  };

  const persistGrades = async (nextGrades: any[]) => {
    const response = await fetch('/api/teacher/grades', {
      method: 'POST',
      headers: {
        Authorization: ['Bearer', accessToken].join(' '),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grades: nextGrades }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed to save grades (${response.status})`);
    return Array.isArray(data.grades) ? data.grades : nextGrades;
  };

  const filteredGrades = grades.filter((grade: any) => {
    const student = students.find((s: any) => String(s.id) === String(grade.studentId));
    if (!student) return false;

    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         grade.assignment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         grade.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || grade.subject === selectedSubject;
    const matchesClass = selectedClass === 'all' || grade.classId === selectedClass;
    return matchesSearch && matchesSubject && matchesClass;
  });

  const handleUpdateGrade = async (gradeId: any, updatedData: any) => {
    const nextGrades = grades.map((grade: any) =>
      grade.id === gradeId ? { ...grade, ...updatedData } : grade
    );
    try {
      const savedGrades = await persistGrades(nextGrades);
      setGrades(savedGrades);
      setEditingGrade(null);
      setIsEditDialogOpen(false);
      toast.success('Grade updated successfully!');
    } catch (error: any) {
      console.error('Error updating grade:', error);
      toast.error(error.message || 'Failed to update grade');
    }
  };

  const handleAddGrade = async () => {
    if (!newGrade.studentId || !newGrade.subject || !newGrade.assignment || !newGrade.grade) {
      toast.error('Please fill in all required fields');
      return;
    }

    const student = students.find((s: any) => String(s.id) === String(newGrade.studentId));
    if (!student) {
      toast.error('Student not found');
      return;
    }

    // Determine if grade is a letter grade or numeric
    const gradeValue = letterGrades.find((lg: any) => lg.value === newGrade.grade);
    
    const grade = {
      id: Date.now(),
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email, // Store student email for backend matching
      classId: newGrade.classId || student.classId,
      subject: newGrade.subject,
      assignment: newGrade.assignment,
      grade: gradeValue ? newGrade.grade : null, // Store letter grade if applicable
      score: gradeValue ? gradeValue.percentage : parseFloat(newGrade.grade),
      maxScore: 100,
      date: newGrade.date,
      feedback: newGrade.feedback
    };

    try {
      const savedGrades = await persistGrades([grade, ...grades]);
      setGrades(savedGrades);
    } catch (error: any) {
      console.error('Error adding grade:', error);
      toast.error(error.message || 'Failed to save grade');
      return;
    }
    setNewGrade({
      studentId: '',
      classId: '',
      subject: '',
      assignment: '',
      grade: '',
      date: new Date().toISOString().split('T')[0],
      feedback: ''
    });
    setIsAddDialogOpen(false);
    toast.success('New grade added successfully!');
  };

  const getGradeColor = (score: any, maxScore: any) => {
    const percentage = (score / maxScore) * 100;
    return percentage < 60 ? 'text-destructive' : 'text-foreground';
  };

  const getGradeBadge = (score: any, maxScore: any) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return <Badge>A</Badge>;
    if (percentage >= 60) return <Badge variant="secondary">{percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : 'D'}</Badge>;
    return <Badge variant="destructive">F</Badge>;
  };

  const getStudentById = (studentId: any) => {
    return students.find((s: any) => s.id === studentId);
  };

  const getClassById = (classId: any) => {
    return classes.find((c: any) => c.id === classId);
  };

  const calculateStudentAverage = (studentId: any) => {
    const studentGrades = grades.filter((g: any) => g.studentId === studentId);
    if (studentGrades.length === 0) return 0;
    
    const totalPercentage = studentGrades.reduce((acc: number, grade: any) => {
      return acc + (grade.score / grade.maxScore) * 100;
    }, 0);
    
    return (totalPercentage / studentGrades.length).toFixed(1);
  };

  const exportGrades = () => {
    if (filteredGrades.length === 0) {
      toast.error('No grades match the current filters');
      return;
    }

    const escapeCsv = (value: unknown) => {
      const text = String(value ?? '');
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Student', 'Email', 'Class', 'Subject', 'Assignment', 'Score', 'Maximum score', 'Percentage', 'Grade', 'Date', 'Feedback'],
      ...filteredGrades.map((grade: any) => {
        const student = getStudentById(grade.studentId);
        const classData = getClassById(grade.classId);
        return [
          student?.name,
          student?.email,
          classData?.name,
          grade.subject,
          grade.assignment,
          grade.score,
          grade.maxScore,
          grade.maxScore ? `${((grade.score / grade.maxScore) * 100).toFixed(1)}%` : '',
          grade.grade,
          grade.date,
          grade.feedback,
        ];
      }),
    ];
    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `grades-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Exported ${filteredGrades.length} grade records`);
  };

  // Empty state when no students exist
  if (students.length === 0) {
    return (
      <div className="p-6">
        <Card className="shadow-none">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="mb-4 inline-flex size-20 items-center justify-center rounded-full bg-muted">
                <UserPlus className="size-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium">No Students Added Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                You need to add students first before you can manage their marks. 
                Start by adding students from the sidebar menu.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-end gap-2">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="w-4 h-4 mr-2" />
            Add Grade
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Grade</DialogTitle>
            </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="classFilter">Class Filter (Optional)</Label>
                    <Select 
                      value={newGrade.classId} 
                      onValueChange={(value) => {
                        setNewGrade({
                          ...newGrade, 
                          classId: value ?? '',
                          studentId: '' // Reset student when class changes
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="studentId">Student *</Label>
                    <Select 
                      value={newGrade.studentId} 
                      onValueChange={(value) => {
                        if (!value) {
                          setNewGrade({ ...newGrade, studentId: '' });
                          return;
                        }
                        const student = students.find(s => String(s.id) === value);
                        setNewGrade({
                          ...newGrade, 
                          studentId: value,
                          classId: student?.classId || newGrade.classId
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Group students by class */}
                        {newGrade.classId && newGrade.classId !== 'all' ? (
                          // Show only students from selected class
                          students
                            .filter(s => s.classId === newGrade.classId)
                            .map((student) => (
                              <SelectItem key={student.id} value={student.id.toString()}>
                                {student.name} - {student.className}
                              </SelectItem>
                            ))
                        ) : (
                          // Show all students grouped by class
                          classes.map((cls) => {
                            const classStudents = students.filter(s => s.classId === cls.id);
                            if (classStudents.length === 0) return null;
                            return (
                              <React.Fragment key={cls.id}>
                                <SelectItem value={`header-${cls.id}`} disabled className="font-semibold text-foreground">
                                  {cls.name} ({classStudents.length} students)
                                </SelectItem>
                                {classStudents.map((student) => (
                                  <SelectItem key={student.id} value={student.id.toString()} className="pl-6">
                                    {student.name}
                                  </SelectItem>
                                ))}
                              </React.Fragment>
                            );
                          })
                        )}
                        {/* Show unassigned students */}
                        {students.filter(s => !s.classId).length > 0 && (
                          <React.Fragment>
                            <SelectItem value="header-unassigned" disabled className="font-semibold text-muted-foreground">
                              Unassigned ({students.filter(s => !s.classId).length} students)
                            </SelectItem>
                            {students
                              .filter(s => !s.classId)
                              .map((student) => (
                                <SelectItem key={student.id} value={student.id.toString()} className="pl-6">
                                  {student.name}
                                </SelectItem>
                              ))}
                          </React.Fragment>
                        )}
                      </SelectContent>
                    </Select>
                    {newGrade.classId && newGrade.classId !== 'all' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Showing students from {classes.find(c => c.id === newGrade.classId)?.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Select value={newGrade.subject} onValueChange={(value) => setNewGrade({...newGrade, subject: value ?? ''})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {dentalSubjects.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="assignment">Assignment/Exam Name *</Label>
                    <Input
                      id="assignment"
                      value={newGrade.assignment}
                      onChange={(e) => setNewGrade({...newGrade, assignment: e.target.value})}
                      placeholder="e.g., Midterm Exam, Practical Lab 1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="grade">Grade *</Label>
                    <Select value={newGrade.grade} onValueChange={(value) => setNewGrade({...newGrade, grade: value ?? ''})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {letterGrades.map((grade) => (
                          <SelectItem key={grade.value} value={grade.percentage.toString()}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{grade.label}</span>
                              <span className="text-muted-foreground text-sm">- {grade.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newGrade.date}
                      onChange={(e) => setNewGrade({...newGrade, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="feedback">Feedback</Label>
                    <Textarea
                      id="feedback"
                      value={newGrade.feedback}
                      onChange={(e) => setNewGrade({...newGrade, feedback: e.target.value})}
                      placeholder="Optional feedback for student"
                      rows={3}
                    />
                  </div>
                  <Button 
                    onClick={handleAddGrade} 
                    className="w-full"
                  >
                    Add Grade
                  </Button>
                </div>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          disabled={filteredGrades.length === 0}
          onClick={exportGrades}
        >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Students" value={students.length} icon={<GraduationCap aria-hidden="true" />} />
        <KpiCard label="Grades recorded" value={grades.length} icon={<BookOpen aria-hidden="true" />} />
        <KpiCard label="Classes" value={classes.length} icon={<Filter aria-hidden="true" />} />
        <KpiCard
          label="Average score"
          value={grades.length
            ? grades.reduce((sum, grade) => sum + (grade.maxScore ? grade.score / grade.maxScore : 0), 0) / grades.length
            : 0}
          format="percent"
          icon={<Save aria-hidden="true" />}
        />
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students, assignments, or subjects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedClass} onValueChange={(value) => setSelectedClass(value ?? 'all')}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedSubject} onValueChange={(value) => setSelectedSubject(value ?? 'all')}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {dentalSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredGrades.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-muted">
                <BookOpen className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Grades Yet</h3>
              <p className="text-muted-foreground mb-4">
                {grades.length === 0 
                  ? 'Start by adding grades for your students using the "Add Grade" button above.'
                  : 'No grades found matching your search criteria.'
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrades.map((grade) => {
                  const student = getStudentById(grade.studentId);
                  const classData = getClassById(grade.classId);
                  return (
                    <TableRow key={grade.id}>
                      <TableCell className="font-medium">
                        {student ? student.name : 'Unknown Student'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {classData ? classData.name : 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {grade.subject}
                        </Badge>
                      </TableCell>
                      <TableCell>{grade.assignment}</TableCell>
                      <TableCell>
                        <span className={getGradeColor(grade.score, grade.maxScore)}>
                          {grade.score}/{grade.maxScore} ({((grade.score / grade.maxScore) * 100).toFixed(0)}%)
                        </span>
                      </TableCell>
                      <TableCell>
                        {getGradeBadge(grade.score, grade.maxScore)}
                      </TableCell>
                      <TableCell>{new Date(grade.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Dialog open={isEditDialogOpen && editingGrade?.id === grade.id} onOpenChange={(open: boolean) => {
                          setIsEditDialogOpen(open);
                          if (!open) setEditingGrade(null);
                        }}>
                          <DialogTrigger
                            render={
                              <Button
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingGrade(grade);
                                setIsEditDialogOpen(true);
                              }}
                              />
                            }
                          >
                              <Edit className="w-4 h-4" />
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Edit Grade</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Student: {student?.name}</Label>
                              </div>
                              <div>
                                <Label>Assignment: {grade.assignment}</Label>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor="editScore">Score</Label>
                                  <Input
                                    id="editScore"
                                    type="number"
                                    defaultValue={grade.score}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingGrade((eg: any) => ({...(eg || grade), score: parseFloat(e.target.value)}))}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="editMaxScore">Max Score</Label>
                                  <Input
                                    id="editMaxScore"
                                    type="number"
                                    defaultValue={grade.maxScore}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingGrade((eg: any) => ({...(eg || grade), maxScore: parseFloat(e.target.value)}))}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="editFeedback">Feedback</Label>
                                <Textarea
                                  id="editFeedback"
                                  defaultValue={grade.feedback}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingGrade((eg: any) => ({...(eg || grade), feedback: e.target.value}))}
                                  rows={3}
                                />
                              </div>
                              <Button 
                                onClick={() => handleUpdateGrade(grade.id, editingGrade || {})}
                                className="w-full"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Update Grade
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
