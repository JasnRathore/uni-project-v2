"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
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
  students?: { classId?: string | null }[];
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const closeAddDialog = () => {
    setIsAddDialogOpen(false);
  };

  // Calculate real-time student count for each class
  const getStudentCount = (classId: string) => {
    return students.filter(student => student.classId === classId).length;
  };

  const filteredClasses = classes.filter(classItem =>
    classItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    classItem.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (classItem.subject && classItem.subject.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button className="sm:order-1" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add New Class
          </Button>
        <div className="relative w-full sm:order-2 sm:ml-auto sm:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
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
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">{classItem.name}</CardTitle>
                  <Badge variant="secondary" className="mb-2">
                    {classItem.grade}
                  </Badge>
                  {classItem.subject && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="w-3 h-3" />
                      <span>{classItem.subject}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-muted p-1">
                    <Users className="size-3 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">{getStudentCount(classItem.id)} Students</span>
                </div>
                {classItem.capacity && (
                  <Badge variant="outline" className="text-xs">
                    Capacity: {classItem.capacity}
                  </Badge>
                )}
              </div>

              {classItem.description && (
                <div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {classItem.description}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={() => onViewClass(classItem)}
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View Class
                </Button>
                <Button 
                  onClick={() => onDeleteClass(classItem.id)}
                  variant="destructive"
                  size="sm"
                  aria-label={`Delete ${classItem.name}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
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
