"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Trophy } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

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
    <div className="space-y-8 animate-in fade-in duration-500 overflow-hidden">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-block p-3 bg-indigo-50 rounded-3xl mb-2">
          <Trophy className="w-12 h-12 text-indigo-600" />
        </div>
        <h2 className="text-4xl font-black text-gray-900 tracking-tight">
          STUDENT LEADERBOARD
        </h2>
        <p className="text-gray-500 font-medium">
          Rankings are based on experience earned from graded assignments and
          quizzes, and are limited to your BDS year, class, or batch.
        </p>
        {data?.scope && (
          <p className="inline-flex rounded-full bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700">
            {data.scope.label}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-indigo-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-semibold">Loading your class leaderboard...</span>
        </div>
      ) : error ? (
        <Card className="mx-auto max-w-xl border-red-100">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="font-semibold text-gray-800">{error}</p>
            <Button
              variant="outline"
              onClick={() => {
                setIsLoading(true);
                setError("");
                setReloadCount((count) => count + 1);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !data?.scope ? (
        <Card className="mx-auto max-w-xl">
          <CardContent className="p-8 text-center text-gray-600">
            {data?.message || "Your BDS year, class, or batch is not set on your profile yet."}
          </CardContent>
        </Card>
      ) : data.leaderboard.length === 0 ? (
        <Card className="mx-auto max-w-xl">
          <CardContent className="p-8 text-center text-gray-600">
            No registered students are in this cohort yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="mx-auto max-w-4xl overflow-hidden border-0 shadow-xl">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4">
              <div>
                <h3 className="font-black text-gray-900">Cohort rankings</h3>
                <p className="text-sm text-gray-500">
                  {data.leaderboard.length} student{data.leaderboard.length === 1 ? "" : "s"}
                </p>
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
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
            <ol className="divide-y">
              {data.leaderboard.map((entry) => (
                <li
                  key={entry.id}
                  className={`flex items-center gap-4 px-5 py-4 sm:px-6 ${
                    entry.isCurrentStudent ? "bg-indigo-50/80" : "bg-white"
                  }`}
                >
                  <span
                    className={`w-12 shrink-0 text-center text-lg font-black ${
                      entry.rank === 1
                        ? "text-amber-500"
                        : entry.rank === 2
                          ? "text-slate-500"
                          : entry.rank === 3
                            ? "text-orange-600"
                            : "text-gray-400"
                    }`}
                    aria-label={`Rank ${entry.rank}`}
                  >
                    #{entry.rank}
                  </span>
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarFallback className="bg-indigo-100 font-bold text-indigo-700">
                      {entry.avatar || entry.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900">
                      {entry.name}
                      {entry.isCurrentStudent && (
                        <span className="ml-2 text-xs font-bold uppercase tracking-wide text-indigo-600">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-xs font-semibold text-gray-500">
                      {entry.rollNumber ? `Roll no. ${entry.rollNumber} · ` : ""}
                      Level {entry.level}
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-black text-indigo-700">
                    {entry.totalExperience.toLocaleString()}
                    <span className="ml-1 text-xs font-bold text-gray-500">XP</span>
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
