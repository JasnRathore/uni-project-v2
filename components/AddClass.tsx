"use client";

import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface DegreeOption {
  id: string;
  name: string;
}

interface ProgramYearOption {
  id: string;
  label: string;
}

interface SubjectOption {
  id: string;
  name: string;
  degree_id: string;
  program_year_id: string;
  degree_name: string;
  program_year_label: string;
}

export interface ManagedClass {
  id: string;
  name: string;
  subjectId: string;
  subject: string;
  degreeId: string;
  degreeName: string;
  programYearId: string;
  programYearLabel: string;
  grade: string;
  description?: string;
  capacity?: number;
  studentCount?: number;
  createdAt?: string;
}

interface AddClassProps {
  accessToken: string;
  onBack: () => void;
  onAddClass: (newClass: ManagedClass) => Promise<boolean>;
}

async function fetchOptions<T>(url: string, accessToken: string, key: string): Promise<T[]> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Unable to load ${key}`);
  return Array.isArray(data[key]) ? data[key] : [];
}

export function AddClass({ accessToken, onBack, onAddClass }: AddClassProps) {
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [programYears, setProgramYears] = useState<ProgramYearOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [degreeId, setDegreeId] = useState("");
  const [programYearId, setProgramYearId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [className, setClassName] = useState("");
  const [capacity, setCapacity] = useState("30");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchOptions<DegreeOption>("/api/academic/degrees", accessToken, "degrees")
      .then(result => { if (active) setDegrees(result); })
      .catch(error => { if (active) toast.error(error.message); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    if (!degreeId) return () => { active = false; };
    void fetchOptions<ProgramYearOption>(
      `/api/academic/degrees/${encodeURIComponent(degreeId)}/program-years`,
      accessToken,
      "programYears",
    ).then(result => { if (active) setProgramYears(result); })
      .catch(error => { if (active) toast.error(error.message); });
    return () => { active = false; };
  }, [accessToken, degreeId]);

  useEffect(() => {
    let active = true;
    if (!programYearId) return () => { active = false; };
    void fetchOptions<SubjectOption>(
      `/api/academic/program-years/${encodeURIComponent(programYearId)}/subjects`,
      accessToken,
      "subjects",
    ).then(result => { if (active) setSubjects(result); })
      .catch(error => { if (active) toast.error(error.message); });
    return () => { active = false; };
  }, [accessToken, programYearId]);

  const selectedSubject = subjects.find(subject => subject.id === subjectId);
  const selectedProgramYear = programYears.find(programYear => programYear.id === programYearId);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSubject || !selectedProgramYear) {
      toast.error("Choose a degree, program year, and subject.");
      return;
    }
    const name = className.trim() || `${selectedSubject.name} · ${selectedProgramYear.label}`;
    setIsSaving(true);
    try {
      const added = await onAddClass({
        id: `class-${crypto.randomUUID()}`,
        name,
        subjectId: selectedSubject.id,
        subject: selectedSubject.name,
        degreeId: selectedSubject.degree_id,
        degreeName: selectedSubject.degree_name,
        programYearId: selectedProgramYear.id,
        programYearLabel: selectedProgramYear.label,
        grade: selectedProgramYear.label,
        capacity: Number(capacity) || 30,
        studentCount: 0,
        createdAt: new Date().toISOString(),
      });
      if (!added) return;
      toast.success("Class created.");
      onBack();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create class.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="class-degree">Degree *</Label>
        <Select value={degreeId} onValueChange={value => {
          setDegreeId(value ?? "");
          setProgramYears([]);
          setSubjects([]);
          setProgramYearId("");
          setSubjectId("");
        }}>
          <SelectTrigger id="class-degree">
            <SelectValue placeholder={isLoading ? "Loading degrees…" : "Choose a degree"} />
          </SelectTrigger>
          <SelectContent>
            {degrees.map(degree => <SelectItem key={degree.id} value={degree.id}>{degree.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="class-program-year">Program year *</Label>
        <Select value={programYearId} onValueChange={value => {
          setProgramYearId(value ?? "");
          setSubjects([]);
          setSubjectId("");
        }} disabled={!degreeId}>
          <SelectTrigger id="class-program-year">
            <SelectValue placeholder="Choose a program year" />
          </SelectTrigger>
          <SelectContent>
            {programYears.map(year => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="class-subject">Subject *</Label>
        <Select value={subjectId} onValueChange={value => setSubjectId(value ?? "")} disabled={!programYearId}>
          <SelectTrigger id="class-subject">
            <SelectValue placeholder="Choose a catalog subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {programYearId && subjects.length === 0 && (
          <p role="status" className="text-sm text-muted-foreground">No subjects are registered for this program year yet.</p>
        )}
      </div>

      {selectedSubject && selectedProgramYear && (
        <div className="rounded-lg bg-muted/60 p-4 text-sm">
          <p className="font-medium">{selectedSubject.name} · {selectedProgramYear.label}</p>
          <p className="mt-1 text-muted-foreground">{selectedSubject.degree_name}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="class-name">Class name (optional)</Label>
        <Input
          id="class-name"
          value={className}
          onChange={event => setClassName(event.target.value)}
          placeholder={selectedSubject && selectedProgramYear ? `${selectedSubject.name} · ${selectedProgramYear.label}` : "e.g. Monday morning seminar"}
          maxLength={100}
        />
        <p className="text-sm text-muted-foreground">You can create multiple classes for the same catalog subject.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="capacity">Class capacity</Label>
        <Input
          id="capacity"
          type="number"
          value={capacity}
          onChange={event => setCapacity(event.target.value)}
          min="1"
          max="1000"
        />
      </div>

      <Button type="submit" className="w-full" disabled={!selectedSubject || isSaving}>
        <Save aria-hidden="true" className="mr-2 size-4" />
        {isSaving ? "Creating class…" : "Create class"}
      </Button>
    </form>
  );
}
