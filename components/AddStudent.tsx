"use client";

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

interface AddStudentProps {
  onBack: () => void;
  classes: Array<{ id: string | number; name: string; subject?: string }>;
  onAddStudent: (student: any) => Promise<void>;
}

export function AddStudent({ onBack, classes, onAddStudent }: AddStudentProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    classId: '',
    subjects: '',
    notes: '',
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Enter the student name and email address.');
      return;
    }
    const selectedClass = classes.find(classItem => String(classItem.id) === formData.classId);
    if (!selectedClass) {
      toast.error('Select a class before adding the student.');
      return;
    }

    const newStudent = {
      id: Date.now(),
      name: formData.name.trim(),
      email: formData.email.trim(),
      classId: selectedClass.id,
      className: selectedClass.name,
      avatar: formData.name.split(' ').map(name => name[0]).join('').toUpperCase(),
      currentLevel: 1,
      totalPoints: 0,
      gameProgress: 0,
      lastActive: 'Just joined',
      status: 'active',
      subjects: formData.subjects
        ? formData.subjects.split(',').map(subject => subject.trim()).filter(Boolean)
        : selectedClass.subject ? [selectedClass.subject] : [],
      averageGrade: 0,
      notes: formData.notes.trim(),
    };

    setIsSaving(true);
    try {
      await onAddStudent(newStudent);
      setFormData({ name: '', email: '', classId: '', subjects: '', notes: '' });
      toast.success('Student added successfully.');
      onBack();
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add student.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-student-name">Full name</Label>
          <Input
            id="new-student-name"
            autoComplete="name"
            value={formData.name}
            onChange={event => setFormData({ ...formData, name: event.target.value })}
            placeholder="Student's full name"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-student-email">Email address</Label>
          <Input
            id="new-student-email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={event => setFormData({ ...formData, email: event.target.value })}
            placeholder="student@school.edu"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-student-class">Class</Label>
        <Select
          value={formData.classId}
          onValueChange={value => setFormData({ ...formData, classId: value ?? '' })}
        >
          <SelectTrigger id="new-student-class" className="w-full">
            <SelectValue placeholder="Select a class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map(classItem => (
              <SelectItem key={classItem.id} value={String(classItem.id)}>
                {classItem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {classes.length === 0 && (
          <p className="text-sm text-muted-foreground">Add a class before adding a student.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-student-subjects">Subjects <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          id="new-student-subjects"
          value={formData.subjects}
          onChange={event => setFormData({ ...formData, subjects: event.target.value })}
          placeholder="Separate subjects with commas"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-student-notes">Additional notes <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea
          id="new-student-notes"
          value={formData.notes}
          onChange={event => setFormData({ ...formData, notes: event.target.value })}
          placeholder="Add relevant student information"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || classes.length === 0}>
          <Save data-icon="inline-start" />
          {isSaving ? 'Adding…' : 'Add student'}
        </Button>
      </div>
    </form>
  );
}
