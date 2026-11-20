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
import { downloadCsv } from '@/lib/csv';
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

export function MarksManagement({ students, classes, accessToken }: { students: any[]; classes: any[]; accessToken: string }) {
  const [grades, setGrades] = useState<any[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newGrade, setNewGrade] = useState({
    studentId: '',
    classId: '',
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
    if (accessToken) loadGrades();
    else setIsLoadingGrades(false);
  }, [accessToken]);

  const syncGradesToBackend = async () => {
    if (!accessToken) return;
    
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

    const search = searchTerm.toLowerCase();
    const matchesSearch = String(student.name || '').toLowerCase().includes(search) ||
                         String(grade.assignment || '').toLowerCase().includes(search) ||
                         String(grade.subject || '').toLowerCase().includes(search);
    const gradeClass = classes.find((classItem: any) => String(classItem.id) === String(grade.classId));
    const matchesSubject = selectedSubject === 'all' || (gradeClass?.subject || gradeClass?.subject_name) === selectedSubject;
    const matchesClass = selectedClass === 'all' || String(grade.classId) === selectedClass;
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
    if (!newGrade.studentId || !newGrade.classId || !newGrade.assignment || !newGrade.grade) {
      toast.error('Choose a class and student, then complete the grade details');
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
      studentId: String(student.id),
      studentName: student.name,
      classId: newGrade.classId,
      subject: getClassById(newGrade.classId)?.subject,
      assignment: newGrade.assignment,
      taskId: null,
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
    return students.find((s: any) => String(s.id) === String(studentId));
  };

  const getClassById = (classId: any) => {
    return classes.find((c: any) => String(c.id) === String(classId));
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
    if (isLoadingGrades) {
      toast.error('Grades are still loading. Try exporting again in a moment.');
      return;
    }
    if (filteredGrades.length === 0) {
      toast.error('No grades match the current filters');
      return;
    }

    const rows = [
      ['Student', 'PRN', 'Email', 'Class', 'Subject', 'Assignment', 'Score', 'Maximum score', 'Percentage', 'Grade', 'Date', 'Feedback'],
      ...filteredGrades.map((grade: any) => {
        const student = getStudentById(grade.studentId);
        const classData = getClassById(grade.classId);
        const percentage = grade.maxScore
          ? ((Number(grade.score) / Number(grade.maxScore)) * 100)
          : null;
        return [
          student?.name,
          student?.prn,
          student?.email,
          classData?.name,
          grade.subject || classData?.subject || classData?.subject_name,
          grade.assignment,
          grade.score,
          grade.maxScore,
          percentage !== null && Number.isFinite(percentage) ? `${percentage.toFixed(1)}%` : '',
          grade.grade,
          grade.date,
          grade.feedback,
        ];
      }),
    ];
    try {
      downloadCsv(`grades-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      toast.success(`Exported ${filteredGrades.length} grade records`);
    } catch (error) {
      console.error('Error exporting grades:', error);
      toast.error('Could not download the CSV file. Please try again.');
    }
  };

  return (
    <>
    <div className={`faculty-grades-page space-y-6 p-6 ${students.length === 0 ? 'faculty-grades-page-mobile-only' : ''}`}>
      <div className="flex justify-end gap-2">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={<Button className="faculty-grade-add" />}>
            <Plus className="w-4 h-4 mr-2" />
            Add Grade
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Grade</DialogTitle>
            </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="classFilter">Class *</Label>
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
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} · {cls.subject}
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
                        setNewGrade({
                          ...newGrade, 
                          studentId: value,
                          classId: newGrade.classId,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        {newGrade.classId && students
                          .filter(student => String(student.classId) === newGrade.classId
                            || student.classIds?.map(String).includes(newGrade.classId))
                          .map(student => (
                            <SelectItem key={student.id} value={String(student.id)}>
                              {student.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {newGrade.classId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Showing students from {classes.find(c => c.id === newGrade.classId)?.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                      {getClassById(newGrade.classId)?.subject || "Choose a class to see its subject"}
                    </p>
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
          type="button"
          className="faculty-grade-export"
          variant="outline"
          onClick={exportGrades}
        >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="faculty-grade-kpis grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="faculty-grade-mobile-controls">
        <div className="faculty-grade-mobile-search-row">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search grades"
              placeholder="Search students, assignments, or subjects..."
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="faculty-grade-mobile-filter-toggle"
            aria-label={isMobileFiltersOpen ? 'Hide grade filters' : 'Show grade filters'}
            aria-expanded={isMobileFiltersOpen}
            aria-controls="faculty-grade-mobile-filter-options"
            onClick={() => setIsMobileFiltersOpen(open => !open)}
          >
            <Filter aria-hidden="true" />
          </Button>
        </div>
        <div
          id="faculty-grade-mobile-filter-options"
          className={`faculty-grade-mobile-filter-options${isMobileFiltersOpen ? ' is-open' : ''}`}
          aria-hidden={!isMobileFiltersOpen}
        >
          <Select value={selectedClass} onValueChange={value => setSelectedClass(value ?? 'all')}>
            <SelectTrigger aria-label="Filter grades by class" className="w-full">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(cls => (
                <SelectItem key={cls.id} value={String(cls.id)}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSubject} onValueChange={value => setSelectedSubject(value ?? 'all')}>
            <SelectTrigger aria-label="Filter grades by subject" className="w-full">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {[...new Set(classes.map((classItem: any) => classItem.subject).filter(Boolean))].map(subject => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="faculty-grade-records shadow-none">
        <CardHeader className="faculty-grade-records-header">
          <div className="faculty-grade-filters flex flex-col sm:flex-row gap-4">
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
                  {[...new Set(classes.map((classItem: any) => classItem.subject).filter(Boolean))].map((subject) => (
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
            <div className="faculty-grade-empty text-center py-12">
              <div className="faculty-grade-empty-icon mb-4 inline-flex size-16 items-center justify-center rounded-full bg-muted">
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
    {students.length === 0 && (
      <div className="faculty-grades-no-students-desktop p-6">
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
    )}
    </>
  );
}
