"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Trophy } from "lucide-react";
import { RoleAvatar } from "./RoleAvatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

interface LeaderboardEntry {
  studentId: string;
  displayName: string;
  leaderboardXp: number;
  rank: number;
  isCurrentStudent: boolean;
}

interface LeaderboardResponse {
  scope: string;
  scopeId: string | null;
  scopeName: string | null;
  rulesetVersion: string;
  calculatedAt: string;
  entries: LeaderboardEntry[];
}

interface ActiveClass {
  id: string;
  name: string;
  subject: string | null;
}

export function StudentLeaderboard({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [classes, setClasses] = useState<ActiveClass[]>([]);
  const [isClassesLoading, setIsClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [selectedScope, setSelectedScope] = useState("cohort");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/student/leaderboards/classes", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Failed to load classes (${response.status})`);
        setClasses(Array.isArray(result.classes) ? result.classes : []);
        setClassesError("");
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load active leaderboard classes:", loadError);
        setClassesError("Class leaderboards couldn’t be loaded. Refresh to try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsClassesLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, reloadCount]);

  useEffect(() => {
    const controller = new AbortController();

    const leaderboardPath = selectedScope === "cohort"
      ? "/api/student/leaderboards/cohort"
      : `/api/student/leaderboards/classes/${encodeURIComponent(selectedScope.slice("class:".length))}`;

    fetch(leaderboardPath, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error || `Failed to load leaderboard (${response.status})`);
        }
        return result as LeaderboardResponse;
      })
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load student leaderboard:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load leaderboard");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [accessToken, reloadCount, selectedScope]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Leaderboard</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Compare XP earned with students in your cohort or active classes. Grades are shown separately.
            </p>
          </div>
          {data?.scope && (
            <Badge variant="secondary" className="shrink-0">
              {data.scopeName || (data.scope === "cohort" ? "My cohort" : "Class leaderboard")}
              {" · "}Updated {new Date(data.calculatedAt).toLocaleTimeString()}
            </Badge>
          )}
        </div>
      </div>

      <div
        aria-label="Leaderboard scope"
        className="flex gap-2 overflow-x-auto pb-1"
        role="group"
      >
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          variant={selectedScope === "cohort" ? "default" : "outline"}
          aria-pressed={selectedScope === "cohort"}
          onClick={() => {
            setIsLoading(true);
            setSelectedScope("cohort");
          }}
        >
          My cohort
        </Button>
        {classes.map(classItem => {
          const scope = `class:${classItem.id}`;
          return (
            <Button
              key={classItem.id}
              type="button"
              size="sm"
              className="shrink-0"
              variant={selectedScope === scope ? "default" : "outline"}
              aria-pressed={selectedScope === scope}
              onClick={() => {
                setIsLoading(true);
                setSelectedScope(scope);
              }}
            >
              {classItem.name}
            </Button>
          );
        })}
      </div>
      {!isClassesLoading && classes.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {classesError || "You are not assigned to an active class yet, so only the cohort leaderboard is available."}
          </p>
          {classesError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setReloadCount((count) => count + 1);
              }}
            >
              <RefreshCw aria-hidden="true" data-icon="inline-start" />
              Retry
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div aria-busy="true" aria-label="Loading leaderboard" className="space-y-3" role="status">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="max-w-xl shadow-none">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <AlertCircle aria-hidden="true" className="size-5 text-destructive" />
            <p className="text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLoading(true);
                setError("");
                setReloadCount((count) => count + 1);
              }}
            >
              <RefreshCw aria-hidden="true" data-icon="inline-start" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : selectedScope !== "cohort" && classes.length === 0 ? (
        <Card className="max-w-xl shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            You don’t have an active class membership yet. A professor must
            assign you to an active class before its leaderboard appears.
          </CardContent>
        </Card>
      ) : !data?.entries?.length ? (
        <Card className="max-w-xl shadow-none">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <Trophy aria-hidden="true" className="size-8 text-muted-foreground" />
            <h3 className="mt-4 font-medium">No rankings yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {selectedScope === "cohort"
                ? "There are no active students in your cohort yet."
                : "There are no active students assigned to this class yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {(() => {
            const currentStudent = data.entries.find((entry) => entry.isCurrentStudent);

            return (
              <div className="grid gap-3 sm:grid-cols-3">
                {currentStudent && (
                  <Card className="shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Your rank</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">#{currentStudent.rank}</p>
                    </CardContent>
                  </Card>
                )}
                {currentStudent && (
                  <Card className="shadow-none">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Your XP</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {currentStudent.leaderboardXp.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                )}
                <Card className="shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Students ranked</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{data.entries.length}</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

        <Card className="max-w-4xl shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
            <div>
              <CardTitle className="text-base">
                {selectedScope === "cohort" ? "Cohort rankings" : "Class rankings"}
              </CardTitle>
              <CardDescription>
                {data.entries.length} student{data.entries.length === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLoading(true);
                setError("");
                setReloadCount((count) => count + 1);
              }}
              disabled={isLoading}
            >
              <RefreshCw aria-hidden="true" data-icon="inline-start" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ol className="divide-y">
              {data.entries.map((entry) => (
                <li
                  key={entry.studentId}
                  className={`flex items-center gap-4 px-4 py-4 sm:px-6 ${
                    entry.isCurrentStudent ? "bg-accent/50" : ""
                  }`}
                >
                  <span
                    className="w-10 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground"
                    aria-label={`Rank ${entry.rank}`}
                  >
                    #{entry.rank}
                  </span>
                  <RoleAvatar
                    role="student"
                    identifier={entry.studentId}
                    name={entry.displayName}
                    className="size-10"
                    fallbackClassName="text-sm font-medium"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.displayName}
                    </p>
                  </div>
                  {entry.isCurrentStudent && <Badge variant="secondary">You</Badge>}
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {entry.leaderboardXp.toLocaleString()}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">XP</span>
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        </>
      )}
    </div>
  );
}
