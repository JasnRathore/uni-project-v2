"use client";
import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSpinner } from './ui/loading';
interface AddDailyTaskProps {
  selectedClass?: any;
  classes?: any[];
  students?: any[];
  onBack: () => void;
  onTaskCreated: (task: any) => void;
  accessToken: string;
}

export function AddDailyTask({ selectedClass, classes = [], students = [], onBack, onTaskCreated, accessToken }: AddDailyTaskProps) {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(selectedClass?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [rewardPoints, setRewardPoints] = useState('100');
  const [loading, setLoading] = useState(false);

  const activeClass = selectedClass || classes.find((c: any) => c.id === selectedClassId) || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskTitle.trim() || !taskDescription.trim() || !dueDate || !activeClass) {
      toast.error('Choose a class and fill in all required fields');
      return;
    }

    if (!accessToken) {
      toast.error('Authentication error. Please log in again.');
      return;
    }

    setLoading(true);

    try {
      const pts = parseInt(rewardPoints) || 100;
      const taskPayload = {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        points: pts,
        date: dueDate,
        class_id: activeClass.id,
        priority: priority,
        type: 'task',
      };

      const response = await fetch('/api/teacher/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: `task-${Date.now()}`,
          title: taskPayload.title,
          description: taskPayload.description,
          maxPoints: pts,
          points: pts,
          dueDate,
          date: dueDate,
          classId: activeClass.id,
          className: activeClass.name,
          subjectId: activeClass.subjectId,
          priority,
          type: 'task',
          status: 'active',
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Server error ${response.status}`);
      }

      const result = await response.json();
      const createdTask = result.task || result;

      const assignedCount = result.assignedCount ?? students.filter((s: any) =>
        s.classId === activeClass.id || s.classIds?.includes(activeClass.id),
      ).length;

      const assignMsg = `Task created and assigned to ${assignedCount} student(s) in ${activeClass.name}!`;
      toast.success(assignMsg);

      if (onTaskCreated) onTaskCreated(createdTask);
      onBack();
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task: ' + (error.message || 'Unknown error'));
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Button onClick={onBack} variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="ml-2 text-foreground">
            {activeClass
              ? `This task will be automatically assigned to all students enrolled in ${activeClass.name}.`
              : 'Tasks must be assigned to a class.'}
          </AlertDescription>
        </Alert>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base font-semibold">
                  Task Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Master Oral Pathology Case Studies"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-semibold">
                  Task Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe what students need to accomplish..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={4}
                  className="text-base"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="task-class" className="text-base font-semibold">Class *</Label>
                  {selectedClass ? (
                    <Input value={selectedClass.name} disabled className="text-base" />
                  ) : (
                    <Select value={selectedClassId} onValueChange={value => setSelectedClassId(value ?? '')}>
                      <SelectTrigger id="task-class" className="text-base">
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} · {cls.subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-base font-semibold">
                    Due Date                     <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-base font-semibold">Priority</Label>
                  <Select value={priority} onValueChange={value => setPriority(value ?? 'Medium')}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="points" className="text-base font-semibold">
                    Reward Points                     <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="points"
                    type="number"
                    min="10"
                    max="1000"
                    value={rewardPoints}
                    onChange={(e) => setRewardPoints(e.target.value)}
                    className="text-base"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 justify-end">
                <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !activeClass}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner className="mr-2 size-4 text-primary-foreground" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create Task
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
