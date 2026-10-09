"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search, Users, BookOpen, Plus, Eye, Trash2 } from 'lucide-react';
import { AddClass } from './AddClass';
import type { DentalClass } from './utils/dentalClasses';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface ClassManagementProps {
  classes: ManagedClass[];
  onAddClass: (newClass: ManagedClass) => boolean;
  onViewClass: (classItem: ManagedClass) => void;
  onDeleteClass: (classId: string) => void;
  students?: { classId?: string | null; classIds?: string[] }[];
}

interface ManagedClass extends DentalClass {
  capacity?: number;
  studentCount?: number;
  createdAt?: string;
}

export function ClassManagement({
  classes,
  onAddClass,
  onViewClass,
  onDeleteClass,
  students = [],
}: ClassManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const closeAddDialog = () => {
    setIsAddDialogOpen(false);
  };

  // Calculate real-time student count for each class
  const getStudentCount = (classId: string) => {
    return students.filter(student =>
      student.classId === classId || student.classIds?.includes(classId),
    ).length;
  };

  const filteredClasses = classes.filter(classItem =>
    (gradeFilter === 'all' || classItem.grade === gradeFilter) &&
    (
      classItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classItem.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (classItem.subject && classItem.subject.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );
  const grades = [...new Set(classes.map(classItem => classItem.grade))].sort();

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button className="sm:order-1" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add New Class
          </Button>
        <div className="flex w-full flex-col gap-2 sm:order-2 sm:ml-auto sm:max-w-xl sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={gradeFilter} onValueChange={value => setGradeFilter(value || 'all')}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter classes by BDS year">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {grades.map(grade => (
                <SelectItem key={grade} value={grade}>{grade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add a class</DialogTitle>
            <DialogDescription>
              Choose a course from the dental curriculum and set its capacity.
            </DialogDescription>
          </DialogHeader>
          <AddClass
            existingClasses={classes}
            onBack={closeAddDialog}
            onAddClass={newClass => {
              return onAddClass(newClass);
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredClasses.map((classItem) => (
          <Card key={classItem.id} className="shadow-none transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-lg">
                    {classItem.subject || classItem.name}
                  </CardTitle>
                  <div className="mt-2">
                    <Badge variant="secondary">{classItem.grade}</Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    onClick={() => onViewClass(classItem)}
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={`View ${classItem.name}`}
                  >
                    <Eye aria-hidden="true" />
                  </Button>
                  <Button
                    onClick={() => onDeleteClass(classItem.id)}
                    variant="destructive"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={`Delete ${classItem.name}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1">
                  <Users aria-hidden="true" className="size-3 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">
                  {getStudentCount(classItem.id)} / {classItem.capacity || 0} students
                </span>
              </div>
              {classItem.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {classItem.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClasses.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <BookOpen className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Classes Found</h3>
          <p className="text-muted-foreground mb-4">
            {classes.length === 0 
              ? "Get started by creating your first class" 
              : "No classes match your search criteria"
            }
          </p>
          {classes.length === 0 && (
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Class
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
