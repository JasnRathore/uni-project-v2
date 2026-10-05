"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Trophy } from "lucide-react";
import { RoleAvatar } from "./RoleAvatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  rollNumber: string;
  totalExperience: number;
  level: number;
  rank: number;
  isCurrentStudent: boolean;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  scope: {
    batch: string | null;
    classId: string | null;
    className: string | null;
    label: string;
  } | null;
  message?: string;
}

export function StudentLeaderboard({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/student/leaderboard", {
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
  }, [accessToken, reloadCount]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Trophy aria-hidden="true" className="size-5" />
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Rankings are based on experience earned from graded assignments and
          quizzes, and are limited to your BDS year, class, or batch.
        </p>
        {data?.scope && (
          <Badge variant="secondary" className="mt-3">
            {data.scope.label}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground" role="status">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          <span>Loading leaderboard…</span>
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
      ) : !data?.scope ? (
        <Card className="max-w-xl shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {data?.message || "Your BDS year, class, or batch is not set on your profile yet."}
          </CardContent>
        </Card>
      ) : data.leaderboard.length === 0 ? (
        <Card className="max-w-xl shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No registered students are in your cohort yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-4xl shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
            <div>
              <CardTitle className="text-base">Cohort rankings</CardTitle>
              <CardDescription>
                {data.leaderboard.length} student{data.leaderboard.length === 1 ? "" : "s"}
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
              {data.leaderboard.map((entry) => (
                <li
                  key={entry.id}
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
                    identifier={entry.id}
                    name={entry.name}
                    className="size-10"
                    fallbackClassName="text-sm font-medium"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.rollNumber ? `Roll no. ${entry.rollNumber} · ` : ""}
                      Level {entry.level}
                    </p>
                  </div>
                  {entry.isCurrentStudent && <Badge variant="secondary">You</Badge>}
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {entry.totalExperience.toLocaleString()}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">XP</span>
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
