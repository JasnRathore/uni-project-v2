"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Plus, Calendar, BookOpen, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface AddTaskProps {
  classData: any;
  onBack: () => void;
  onAddTask: (task: any) => void;
  students: any[];
  accessToken: string;
  embedded?: boolean;
}

export function AddTask({ classData, onBack, onAddTask, students, accessToken, embedded = false }: AddTaskProps) {
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    maxPoints: ''
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!taskData.title || !taskData.description || !taskData.dueDate || !taskData.maxPoints) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/teacher/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', accessToken].join(' '),
        },
        body: JSON.stringify({
          ...taskData,
          dueDate: taskData.dueDate,
          maxPoints: parseInt(taskData.maxPoints, 10),
          classId: classData.id,
          className: classData.name,
          status: 'active',
          type: 'task',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Task creation failed (${response.status})`);
      onAddTask(data);
      toast.success(`Quest "${taskData.title}" assigned to ${data.assignedCount || 0} student(s) in ${classData.name}!`);
      if (embedded) onBack();
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error(error.message || 'Failed to create task');
    }
  };

  return (
    <div className={embedded ? 'w-full' : 'mx-auto max-w-3xl p-6'}>
      {!embedded && <Button
        onClick={onBack}
        variant="ghost"
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Class
      </Button>}

      <Card className={embedded ? "gap-0 py-0 shadow-none ring-0" : undefined}>
        {!embedded && <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            Create Daily Quest for {classData.name}
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            ✨ This quest will be assigned to all students in this class and appear on their dashboard
          </p>
        </CardHeader>}
        <CardContent className={embedded ? "p-0" : "p-6"}>
          <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Label htmlFor="title" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Quest Title *
              </Label>
              <Input
                id="title"
                placeholder="e.g., Master Oral Pathology Case Studies"
                value={taskData.title}
                onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                className="mt-2"
              />
            </div>

            <div className="lg:col-span-2">
              <Label htmlFor="description">Quest Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the quest and what students need to accomplish..."
                value={taskData.description}
                onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                className="mt-2 min-h-[120px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-sm text-muted-foreground">
                Subject: <span className="font-medium text-foreground">{classData.subject}</span>
              </div>
              <div>
                <Label htmlFor="maxPoints" className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Reward Points *
                </Label>
                <Input
                  id="maxPoints"
                  type="number"
                  placeholder="100"
                  value={taskData.maxPoints}
                  onChange={(e) => setTaskData({ ...taskData, maxPoints: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dueDate" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Due Date *
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={taskData.dueDate}
                  onChange={(e) => setTaskData({ ...taskData, dueDate: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={taskData.priority}
                  onValueChange={(value) => setTaskData({ ...taskData, priority: value ?? taskData.priority })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4 lg:col-span-2">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <h4 className="font-medium text-foreground">Quest Assignment</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This daily quest will be automatically assigned to all {classData.studentCount} student(s) currently enrolled in {classData.name}. It will appear as a highlighted quest card on their dashboard!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 lg:col-span-2">
              <Button
                type="submit"
                className="flex-1"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create Quest
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
