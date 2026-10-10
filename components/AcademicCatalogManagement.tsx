"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface CatalogDegree {
  id: string;
  name: string;
}

interface CatalogProgramYear {
  id: string;
  label: string;
}

interface CatalogSubject {
  id: string;
  name: string;
}

interface AcademicCatalogManagementProps {
  accessToken: string;
  canManage: boolean;
}

async function requestJson(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function AcademicCatalogManagement({ accessToken, canManage }: AcademicCatalogManagementProps) {
  const [degrees, setDegrees] = useState<CatalogDegree[]>([]);
  const [programYears, setProgramYears] = useState<CatalogProgramYear[]>([]);
  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [degreeId, setDegreeId] = useState("");
  const [degreeName, setDegreeName] = useState("");
  const [programYearId, setProgramYearId] = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingYear, setIsSavingYear] = useState(false);
  const [isSavingSubject, setIsSavingSubject] = useState(false);
  const [isSavingDegree, setIsSavingDegree] = useState(false);

  const loadDegrees = async () => {
    const result = await requestJson("/api/academic/degrees", accessToken);
    setDegrees(Array.isArray(result.degrees) ? result.degrees : []);
  };

  const loadProgramYears = useCallback(async (selectedDegreeId: string) => {
    if (!selectedDegreeId) return [];
    const result = await requestJson(
      `/api/academic/degrees/${encodeURIComponent(selectedDegreeId)}/program-years`,
      accessToken,
    );
    return Array.isArray(result.programYears) ? result.programYears : [];
  }, [accessToken]);

  const loadSubjects = useCallback(async (selectedProgramYearId: string) => {
    if (!selectedProgramYearId) return [];
    const result = await requestJson(
      `/api/academic/program-years/${encodeURIComponent(selectedProgramYearId)}/subjects`,
      accessToken,
    );
    return Array.isArray(result.subjects) ? result.subjects : [];
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    void requestJson("/api/academic/degrees", accessToken)
      .then(result => { if (active) setDegrees(Array.isArray(result.degrees) ? result.degrees : []); })
      .catch(error => { if (active) toast.error(error.message); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    if (!degreeId) return () => { active = false; };
    void loadProgramYears(degreeId)
      .then(result => { if (active) setProgramYears(result); })
      .catch(error => { if (active) toast.error(error.message); });
    return () => { active = false; };
  }, [degreeId, loadProgramYears]);

  useEffect(() => {
    let active = true;
    if (!programYearId) return () => { active = false; };
    void loadSubjects(programYearId)
      .then(result => { if (active) setSubjects(result); })
      .catch(error => { if (active) toast.error(error.message); });
    return () => { active = false; };
  }, [programYearId, loadSubjects]);

  const handleCreateYear = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!degreeId || !yearLabel.trim()) return;
    setIsSavingYear(true);
    try {
      const result = await requestJson(
        `/api/admin/degrees/${encodeURIComponent(degreeId)}/program-years`,
        accessToken,
        { method: "POST", body: JSON.stringify({ label: yearLabel.trim() }) },
      );
      setYearLabel("");
      setProgramYears(await loadProgramYears(degreeId));
      if (result.programYear?.id) setProgramYearId(result.programYear.id);
      toast.success("Program year added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add program year.");
    } finally {
      setIsSavingYear(false);
    }
  };

  const handleCreateDegree = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!degreeName.trim()) return;
    setIsSavingDegree(true);
    try {
      const result = await requestJson(
        "/api/admin/degrees",
        accessToken,
        { method: "POST", body: JSON.stringify({ name: degreeName.trim() }) },
      );
      setDegreeName("");
      await loadDegrees();
      if (result.degree?.id) setDegreeId(result.degree.id);
      toast.success("Degree added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add degree.");
    } finally {
      setIsSavingDegree(false);
    }
  };

  const handleCreateSubject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!programYearId || !subjectName.trim()) return;
    setIsSavingSubject(true);
    try {
      await requestJson(
        `/api/admin/program-years/${encodeURIComponent(programYearId)}/subjects`,
        accessToken,
        { method: "POST", body: JSON.stringify({ name: subjectName.trim() }) },
      );
      setSubjectName("");
      setSubjects(await loadSubjects(programYearId));
      toast.success("Subject added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add subject.");
    } finally {
      setIsSavingSubject(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Academic catalog</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize degrees into program years and register the subjects that classes can use.
        </p>
      </div>

      {!canManage && (
        <p role="status" className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
          You can view the catalog, but only administrators can add program years or subjects.
        </p>
      )}

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen aria-hidden="true" className="size-5" />
            Browse catalog
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="catalog-degree">Degree</Label>
            <Select
              value={degreeId}
              onValueChange={value => {
                setDegreeId(value ?? "");
                setProgramYearId("");
                setProgramYears([]);
                setSubjects([]);
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="catalog-degree">
                <SelectValue placeholder={isLoading ? "Loading degrees…" : "Choose a degree"} />
              </SelectTrigger>
              <SelectContent>
                {degrees.map(degree => <SelectItem key={degree.id} value={degree.id}>{degree.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-program-year">Program year</Label>
            <Select
              value={programYearId}
              onValueChange={value => setProgramYearId(value ?? "")}
              disabled={!degreeId}
            >
              <SelectTrigger id="catalog-program-year">
                <SelectValue placeholder="Choose a program year" />
              </SelectTrigger>
              <SelectContent>
                {programYears.map(year => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-sm font-medium">Subjects</h3>
            {subjects.length ? (
              <ul className="flex flex-wrap gap-2">
                {subjects.map(subject => (
                  <li key={subject.id} className="rounded-md border px-3 py-1.5 text-sm">{subject.name}</li>
                ))}
              </ul>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                {programYearId ? "No subjects have been registered for this year." : "Select a program year to see its subjects."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card className="shadow-none">
            <CardHeader><CardTitle className="text-base">Add degree</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateDegree} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-degree-name">Degree name *</Label>
                  <Input
                    id="new-degree-name"
                    value={degreeName}
                    onChange={event => setDegreeName(event.target.value)}
                    placeholder="e.g. BDS"
                    maxLength={80}
                  />
                </div>
                <Button type="submit" disabled={!degreeName.trim() || isSavingDegree}>
                  <Plus aria-hidden="true" className="mr-2 size-4" />
                  {isSavingDegree ? "Adding…" : "Add degree"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader><CardTitle className="text-base">Add program year</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateYear} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-year-degree">Degree *</Label>
                  <Select value={degreeId} onValueChange={value => {
                    setDegreeId(value ?? "");
                    setProgramYearId("");
                    setProgramYears([]);
                    setSubjects([]);
                  }}>
                    <SelectTrigger id="new-year-degree"><SelectValue placeholder="Choose a degree" /></SelectTrigger>
                    <SelectContent>
                      {degrees.map(degree => <SelectItem key={degree.id} value={degree.id}>{degree.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-year-label">Program-year label *</Label>
                  <Input
                    id="new-year-label"
                    value={yearLabel}
                    onChange={event => setYearLabel(event.target.value)}
                    placeholder="e.g. BDS 1"
                    maxLength={80}
                  />
                </div>
                <Button type="submit" disabled={!degreeId || !yearLabel.trim() || isSavingYear}>
                  <Plus aria-hidden="true" className="mr-2 size-4" />
                  {isSavingYear ? "Adding…" : "Add program year"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader><CardTitle className="text-base">Add subject</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-subject-year">Program year *</Label>
                  <Select
                    value={programYearId}
                    onValueChange={value => {
                      setProgramYearId(value ?? "");
                      setSubjects([]);
                    }}
                    disabled={!degreeId}
                  >
                    <SelectTrigger id="new-subject-year"><SelectValue placeholder="Choose a program year" /></SelectTrigger>
                    <SelectContent>
                      {programYears.map(year => <SelectItem key={year.id} value={year.id}>{year.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-subject-name">Subject name *</Label>
                  <Input
                    id="new-subject-name"
                    value={subjectName}
                    onChange={event => setSubjectName(event.target.value)}
                    placeholder="e.g. Oral Pathology"
                    maxLength={120}
                  />
                </div>
                <Button type="submit" disabled={!programYearId || !subjectName.trim() || isSavingSubject}>
                  <Plus aria-hidden="true" className="mr-2 size-4" />
                  {isSavingSubject ? "Adding…" : "Add subject"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <Button
        variant="outline"
        className="self-start"
        onClick={() => {
          setIsLoading(true);
          void loadDegrees().then(async () => {
            setProgramYears(await loadProgramYears(degreeId));
            setSubjects(await loadSubjects(programYearId));
          })
            .catch(error => toast.error(error.message))
            .finally(() => setIsLoading(false));
        }}
      >
        <RefreshCw aria-hidden="true" className="mr-2 size-4" />
        Refresh catalog
      </Button>
    </div>
  );
}
