"use client";
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { dentalClasses, getClassesByYear, type DentalClass } from './utils/dentalClasses';

interface ManagedClass extends DentalClass {
  capacity?: number;
  studentCount?: number;
  createdAt?: string;
}

interface AddClassProps {
  existingClasses: ManagedClass[];
  onBack: () => void;
  onAddClass: (newClass: ManagedClass) => boolean;
}

export function AddClass({ existingClasses, onBack, onAddClass }: AddClassProps) {
  const [selectedDentalClass, setSelectedDentalClass] = useState('');
  const [customCapacity, setCustomCapacity] = useState('');
  const classesByYear = getClassesByYear();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDentalClass) {
      toast.error('Please select a class');
      return;
    }

    const selectedClass = dentalClasses.find(c => c.id === selectedDentalClass);
    if (!selectedClass) {
      toast.error('Class not found');
      return;
    }

    const newClass = {
      id: selectedClass.id,
      name: selectedClass.name,
      grade: selectedClass.grade,
      subject: selectedClass.subject,
      description: selectedClass.description,
      capacity: customCapacity ? parseInt(customCapacity) : 30,
      studentCount: 0,
      createdAt: new Date().toISOString()
    };

    if (!onAddClass(newClass)) return;
    toast.success('Class added successfully!');
    setSelectedDentalClass('');
    setCustomCapacity('');
    onBack();
  };

  const selectedClassData = dentalClasses.find(c => c.id === selectedDentalClass);
  const alreadyAdded = existingClasses.some(classItem => classItem.id === selectedDentalClass);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="class">Select Dental Class *</Label>
        <Select value={selectedDentalClass} onValueChange={value => setSelectedDentalClass(value ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a dental class" />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {Object.entries(classesByYear).map(([year, yearClasses]) => (
              <React.Fragment key={year}>
                <div className="sticky top-0 bg-muted/50 px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  {year}
                </div>
                {yearClasses.map(classItem => {
                  const isExisting = existingClasses.some(existing => existing.id === classItem.id);
                  return (
                    <SelectItem key={classItem.id} value={classItem.id} disabled={isExisting}>
                      {classItem.subject}{isExisting ? ' (added)' : ''}
                    </SelectItem>
                  );
                })}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Choose from BDS (1st-5th Year) or MDS (1st-3rd Year) programs
        </p>
      </div>

      {selectedClassData && (
        <div className="rounded-lg bg-muted/60 p-4 text-sm">
          <p className="font-medium">{selectedClassData.name} · {selectedClassData.grade}</p>
          <p className="mt-1 text-muted-foreground">{selectedClassData.description}</p>
        </div>
      )}

      {alreadyAdded && (
        <p role="status" className="text-sm text-destructive">
          This curriculum class has already been added.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="capacity">Class Capacity (Optional)</Label>
        <Input
          id="capacity"
          type="number"
          value={customCapacity}
          onChange={(e) => setCustomCapacity(e.target.value)}
          placeholder="Default: 30 students"
          min="1"
          max="60"
        />
        <p className="text-sm text-muted-foreground">
          Set the maximum number of students for this class
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={!selectedDentalClass || alreadyAdded}>
        <Save className="w-4 h-4 mr-2" />
        Add Class
      </Button>
    </form>
  );
}
