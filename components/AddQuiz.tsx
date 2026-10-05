"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Plus, Clock, Trash2, BookOpen, ListChecks, Type } from 'lucide-react';
import { toast } from 'sonner';

interface AddQuizProps {
  classData: any;
  onBack: () => void;
  onAddQuiz: (quiz: any) => void;
  students: any[];
  accessToken: string;
  embedded?: boolean;
}

type QuestionType = 'single-choice' | 'multiple-choice' | 'short-answer';

interface QuizQuestion {
  id: number;
  question: string;
  type: QuestionType;
  options: string[];
  correctAnswer: number | number[] | string;
}

const createQuestion = (id: number): QuizQuestion => ({
  id,
  question: '',
  type: 'single-choice',
  options: ['', '', '', ''],
  correctAnswer: 0,
});

export function AddQuiz({ classData, onBack, onAddQuiz, students, accessToken, embedded = false }: AddQuizProps) {
  const [quizData, setQuizData] = useState({
    title: '',
    description: '',
    dueDate: '',
    duration: '30', // duration in minutes
    subject: classData.subject || '',
    totalPoints: '100',
    questionCount: '1',
  });

  const [questions, setQuestions] = useState<QuizQuestion[]>([createQuestion(1)]);

  const handleAddQuestion = () => {
    setQuestions(current => [...current, createQuestion(Math.max(...current.map(question => question.id), 0) + 1)]);
    setQuizData(current => ({ ...current, questionCount: String(questions.length + 1) }));
  };

  const handleRemoveQuestion = (questionId: any) => {
    if (questions.length === 1) {
      toast.error('Quiz must have at least one question');
      return;
    }
    setQuestions(current => current.filter(q => q.id !== questionId));
    setQuizData(current => ({ ...current, questionCount: String(Math.max(1, questions.length - 1)) }));
  };

  const updateQuestionCount = (value: string) => {
    const count = Math.min(50, Math.max(1, Number(value) || 1));
    setQuizData(current => ({ ...current, questionCount: String(count) }));
    setQuestions(current => {
      if (count > current.length) {
        return [...current, ...Array.from({ length: count - current.length }, (_, index) => createQuestion(current.length + index + 1))];
      }
      return current.slice(0, count);
    });
  };

  const handleQuestionChange = (questionId: number, field: keyof QuizQuestion, value: any) => {
    setQuestions(current => current.map(q =>
      q.id === questionId ? { ...q, [field]: value } : q
    ));
  };

  const handleTypeChange = (questionId: number, type: QuestionType) => {
    setQuestions(current => current.map(q => q.id === questionId
      ? { ...q, type, correctAnswer: type === 'multiple-choice' ? [] : type === 'short-answer' ? '' : 0 }
      : q));
  };

  const handleOptionChange = (questionId: number, optionIndex: number, value: string) => {
    setQuestions(current => current.map(q =>
      q.id === questionId
        ? { ...q, options: q.options.map((opt, idx) => idx === optionIndex ? value : opt) }
        : q
    ));
  };

  const toggleCorrectAnswer = (questionId: number, optionIndex: number) => {
    setQuestions(current => current.map(q => {
      if (q.id !== questionId) return q;
      if (q.type === 'multiple-choice') {
        const selected = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
        return { ...q, correctAnswer: selected.includes(optionIndex)
          ? selected.filter(index => index !== optionIndex)
          : [...selected, optionIndex] };
      }
      return { ...q, correctAnswer: optionIndex };
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validation
    if (!quizData.title || !quizData.description || !quizData.dueDate || !quizData.duration) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate questions
    for (const question of questions) {
      if (!question.question.trim()) {
        toast.error('All questions must have text');
        return;
      }
    if (question.type === 'short-answer') {
      if (!String(question.correctAnswer).trim()) {
        toast.error('Add an accepted answer for every typed-answer question');
          return;
        }
    } else {
      if (question.options.some(option => !option.trim())) {
        toast.error('All answer options must be filled');
        return;
      }
      const correctAnswers = Array.isArray(question.correctAnswer)
        ? question.correctAnswer
        : [question.correctAnswer];
      if (!correctAnswers.length) {
        toast.error('Select at least one correct answer for every choice question');
        return;
      }
    }
    }

    try {
      const response = await fetch('/api/teacher/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bearer', accessToken].join(' '),
        },
        body: JSON.stringify({
          ...quizData,
          duration: parseInt(quizData.duration, 10),
          totalPoints: parseInt(quizData.totalPoints, 10),
          maxPoints: parseInt(quizData.totalPoints, 10),
          classId: classData.id,
          className: classData.name,
          questions,
          type: 'quiz',
          status: 'active',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Quiz creation failed (${response.status})`);
      onAddQuiz(data);
      toast.success(`Quiz "${quizData.title}" assigned to ${data.assignedCount || 0} student(s) in ${classData.name}`);
      if (embedded) onBack();
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      toast.error(error.message || 'Failed to create quiz');
    }
  };

  return (
    <div className={embedded ? 'w-full' : 'mx-auto max-w-4xl p-6'}>
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
            <Plus className="w-5 h-5" />
            Create Quiz for {classData.name}
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a timed quiz with configurable question types
          </p>
        </CardHeader>}
        <CardContent className={embedded ? "p-0" : "p-6"}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Quiz Info */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <Label htmlFor="title">Quiz Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Oral Pathology - Chapter 1 Quiz"
                  value={quizData.title}
                  onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div className="lg:col-span-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Provide instructions and details about the quiz..."
                  value={quizData.description}
                  onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
                  className="mt-2 min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 lg:col-span-2">
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Subject name"
                    value={quizData.subject}
                    onChange={(e) => setQuizData({ ...quizData, subject: e.target.value })}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    placeholder="30"
                    value={quizData.duration}
                    onChange={(e) => setQuizData({ ...quizData, duration: e.target.value })}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="totalPoints">Total Points *</Label>
                  <Input
                    id="totalPoints"
                    type="number"
                    placeholder="100"
                    value={quizData.totalPoints}
                    onChange={(e) => setQuizData({ ...quizData, totalPoints: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="questionCount">Number of questions *</Label>
                  <Input
                    id="questionCount"
                    type="number"
                    min="1"
                    max="50"
                    value={quizData.questionCount}
                    onChange={(e) => updateQuestionCount(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={quizData.dueDate}
                  onChange={(e) => setQuizData({ ...quizData, dueDate: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            {/* Questions Section */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
                <Button
                  type="button"
                  onClick={handleAddQuestion}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                {questions.map((question, qIndex) => (
                  <Card key={question.id}>
                    <CardHeader className="border-b pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <ListChecks className="size-4 text-muted-foreground" />
                          Question {qIndex + 1}
                        </CardTitle>
                        {questions.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleRemoveQuestion(question.id)}
                            variant="destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                        <Label>Question Text *</Label>
                        <Textarea
                          placeholder="Enter your question here..."
                          value={question.question}
                          onChange={(e) => handleQuestionChange(question.id, 'question', e.target.value)}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label>Question type *</Label>
                        <Select
                          value={question.type}
                          onValueChange={(value) => value && handleTypeChange(question.id, value as QuestionType)}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single-choice">Single correct answer</SelectItem>
                            <SelectItem value="multiple-choice">Multiple correct answers</SelectItem>
                            <SelectItem value="short-answer">Type in the answer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2 text-sm text-muted-foreground">
                        {question.type === 'multiple-choice'
                          ? <><ListChecks className="size-4" /> Select every correct option.</>
                          : question.type === 'short-answer'
                            ? <><Type className="size-4" /> Answers are matched ignoring case and spaces.</>
                            : <><ListChecks className="size-4" /> Select one correct option.</>}
                      </div>
                      </div>

                      {question.type === 'short-answer' ? (
                        <div>
                          <Label htmlFor={`answer-${question.id}`}>Accepted answer *</Label>
                          <Input
                            id={`answer-${question.id}`}
                            placeholder="Expected answer"
                            value={String(question.correctAnswer)}
                            onChange={(e) => handleQuestionChange(question.id, 'correctAnswer', e.target.value)}
                            className="mt-2"
                          />
                        </div>
                      ) : (
                      <div className="space-y-4">
                      <div>
                        <Label>Answer Options *</Label>
                        <div className="space-y-2 mt-2">
                          {question.options.map((option, optIndex) => (
                            <div key={optIndex} className="flex items-center gap-2">
                              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                                {String.fromCharCode(65 + optIndex)}
                              </div>
                              <Input
                                placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                                value={option}
                                onChange={(e) => handleOptionChange(question.id, optIndex, e.target.value)}
                                className={(Array.isArray(question.correctAnswer)
                                  ? question.correctAnswer.includes(optIndex)
                                  : question.correctAnswer === optIndex) ? 'border-primary' : ''}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label>Correct Answer *</Label>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {question.options.map((option, idx) => {
                            const isCorrect = Array.isArray(question.correctAnswer)
                              ? question.correctAnswer.includes(idx)
                              : question.correctAnswer === idx;
                            return (
                              <Button
                                key={idx}
                                type="button"
                                variant={isCorrect ? 'default' : 'outline'}
                                className="justify-start"
                                onClick={() => toggleCorrectAnswer(question.id, idx)}
                              >
                                {isCorrect ? '✓ ' : ''}Option {String.fromCharCode(65 + idx)}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                      </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Assignment Info */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <h4 className="font-medium text-foreground">Quiz Assignment</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This quiz will be automatically assigned to all {classData.studentCount} student(s) currently enrolled in {classData.name}.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Students will have {quizData.duration} minutes to complete the quiz.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Quiz
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
