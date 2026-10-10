"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TakeQuizProps {
  quiz: any;
  onBack: () => void;
  onSubmit: (answers: any) => void;
}

export function TakeQuiz({ quiz, onBack, onSubmit }: TakeQuizProps) {
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(quiz.duration * 60); // Convert to seconds
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!hasStarted || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, timeRemaining]);

  const handleAutoSubmit = () => {
    toast.warning('Time is up! Submitting your quiz automatically...');
    setTimeout(() => {
      handleSubmit();
    }, 1000);
  };

  const handleAnswerSelect = (questionId: any, optionIndex: any) => {
    const question = quiz.questions.find((item: any) => item.id === questionId);
    if (question?.type === 'multiple-choice') {
      const selected = Array.isArray(answers[questionId]) ? answers[questionId] : [];
      setAnswers({
        ...answers,
        [questionId]: selected.includes(optionIndex)
          ? selected.filter((index: number) => index !== optionIndex)
          : [...selected, optionIndex],
      });
      return;
    }
    setAnswers({ ...answers, [questionId]: optionIndex });
  };

  const handleTypedAnswer = (questionId: any, value: string) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  const isAnswerCorrect = (question: any) => {
    const answer = answers[question.id];
    if (question.type === 'short-answer') {
      return String(answer || '').trim().toLowerCase() === String(question.correctAnswer || '').trim().toLowerCase();
    }
    if (question.type === 'multiple-choice') {
      const submitted = Array.isArray(answer) ? [...answer].sort() : [];
      const correct = Array.isArray(question.correctAnswer) ? [...question.correctAnswer].sort() : [];
      return submitted.length === correct.length && submitted.every((value, index) => value === correct[index]);
    }
    return answer === question.correctAnswer;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);

    // Calculate score
    let correctAnswers = 0;
    quiz.questions.forEach((question: any) => {
      if (isAnswerCorrect(question)) {
        correctAnswers++;
      }
    });

    const totalQuestions = quiz.questions.length;
    const answeredQuestions = Object.keys(answers).length;
    const scorePercentage = (correctAnswers / totalQuestions) * 100;
    const pointsEarned = Math.round((correctAnswers / totalQuestions) * quiz.totalPoints);

    const submission = {
      taskId: quiz.id,
      score: pointsEarned,
      maxScore: quiz.totalPoints,
      quizId: quiz.id,
      answers: answers,
      correctAnswers: correctAnswers,
      totalQuestions: totalQuestions,
      answeredQuestions: answeredQuestions,
      unansweredQuestions: totalQuestions - answeredQuestions,
      scorePercentage: scorePercentage,
      pointsEarned: pointsEarned,
      totalPoints: quiz.totalPoints,
      timeSpent: quiz.duration * 60 - timeRemaining,
      submittedAt: new Date().toISOString()
    };

    onSubmit(submission);
    toast.success(`Quiz submitted! You scored ${pointsEarned}/${quiz.totalPoints} points`);
  };

  const formatTime = (seconds: any) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    const percentage = (timeRemaining / (quiz.duration * 60)) * 100;
    if (percentage > 50) return 'text-primary';
    if (percentage > 25) return 'text-amber-600 dark:text-amber-400';
    return 'text-destructive';
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = quiz.questions.length;

  if (!hasStarted) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Button
          onClick={onBack}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="shadow-none">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-xl tracking-tight">{quiz.title}</CardTitle>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{quiz.description}</p>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Duration</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{quiz.duration} min</p>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Total Points</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{quiz.totalPoints}</p>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Questions</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{totalQuestions}</p>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Due Date</span>
                </div>
                <p className="text-lg font-semibold">
                  {new Date(quiz.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
              <h3 className="mb-2 font-semibold">Important Instructions:</h3>
              <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li>• Once you start, the timer will begin and cannot be paused</li>
                <li>• Questions may use single choice, multiple choice, or typed answers</li>
                <li>• You can change your answers before submitting</li>
                <li>• The quiz will auto-submit when time runs out</li>
                <li>• Make sure you have a stable internet connection</li>
              </ul>
            </div>

            <Button
              onClick={() => setHasStarted(true)}
              className="min-h-12 w-full text-base"
            >
              Start Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Fixed Timer Header */}
      <div className="sticky top-0 z-10 mb-6 rounded-xl border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{quiz.title}</h2>
            <p className="text-sm text-muted-foreground">
              Progress: {answeredCount}/{totalQuestions} answered
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getTimerColor()} flex items-center gap-2`}>
              <Clock className="w-8 h-8" />
              {formatTime(timeRemaining)}
            </div>
            <p className="text-sm text-muted-foreground">Time Remaining</p>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {quiz.questions.map((question: any, qIndex: any) => (
          <Card key={question.id} className="shadow-none">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-indigo-500">Question {qIndex + 1}</Badge>
                    {answers[question.id] !== undefined && (
                      <Badge className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Answered
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base leading-relaxed">{question.question}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {question.type === 'short-answer' ? (
                <input
                  type="text"
                  value={answers[question.id] || ''}
                  onChange={(event) => handleTypedAnswer(question.id, event.target.value)}
                  placeholder="Type your answer"
                  aria-label={`Answer for question ${qIndex + 1}`}
                  className="min-h-12 w-full rounded-md border border-input bg-background px-3 py-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              ) : (
              <div className="space-y-3">
                  {question.options.map((option: any, optIndex: any) => {
                  const selectedAnswers = Array.isArray(answers[question.id]) ? answers[question.id] : [answers[question.id]];
                  const isSelected = selectedAnswers.includes(optIndex);
                  return (
                    <button
                      type="button"
                      key={optIndex}
                      onClick={() => handleAnswerSelect(question.id, optIndex)}
                      aria-pressed={isSelected}
                      className={`flex min-h-12 w-full items-center rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {question.type === 'multiple-choice' ? (isSelected ? '✓' : '') : String.fromCharCode(65 + optIndex)}
                        </div>
                        <span className={isSelected ? 'font-medium' : ''}>{option}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit Section */}
      <Card className="mt-6 shadow-none">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg">Ready to submit?</h3>
              <p className="text-sm text-muted-foreground">
                You've answered {answeredCount} out of {totalQuestions} questions
                {answeredCount < totalQuestions && (
                  <span className="font-medium text-destructive">
                    {' '}({totalQuestions - answeredCount} unanswered)
                  </span>
                )}
              </p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="min-h-11 px-8"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
