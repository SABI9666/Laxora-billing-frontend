"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

// "Time worked in application" card for the dashboard: a clock ring with
// today's hours, plus the last 7 days of time worked and entries made
// (bills, payments, products, expenses — edits included).

type UsageDay = {
  day: string;
  label: string;
  seconds: number;
  entries: {
    productsAdded: number;
    productsEdited: number;
    bills: number;
    billEdits: number;
    purchases: number;
    onlineOrders: number;
    payments: number;
    expenses: number;
    total: number;
  };
};

type Summary = {
  days: UsageDay[];
  todaySeconds: number;
  todayEntries: number;
  totalSeconds: number;
  totalEntries: number;
};

// "2h 15m" / "45m" / "—" for zero.
export function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds > 0 ? "< 1m" : "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// A full working day fills the ring.
const FULL_DAY_SEC = 8 * 3600;

export default function WorkClock() {
  const [data, setData] = useState<Summary | null>(null);
  // Extra seconds ticked locally since the last fetch, so the clock moves
  // while you watch it (the server catches up via the heartbeat).
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Summary>("/api/usage/summary?days=7")
        .then((r) => {
          if (!alive) return;
          setData(r);
          setTick(0);
        })
        .catch(() => {});
    load();
    // Tick the visible clock forward each minute; resync with the server
    // every 5 minutes (the heartbeat keeps the server side up to date).
    let beats = 0;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      beats += 1;
      if (beats % 5 === 0) load();
      else setTick((t) => t + 60);
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const todaySeconds = (data?.todaySeconds ?? 0) + tick;
  const weekSeconds = (data?.totalSeconds ?? 0) + tick;
  const progress = Math.min(todaySeconds / FULL_DAY_SEC, 1);

  // Clock ring geometry.
  const R = 56;
  const CIRC = 2 * Math.PI * R;

  const days = data?.days ?? [];
  const maxSeconds = useMemo(
    () => Math.max(1, ...days.map((d) => d.seconds)),
    [days]
  );

  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-bold text-slate-800">⏱ Time Worked in App</h2>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
          this week {formatDuration(weekSeconds)}
        </span>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        How long the application was open and how many entries were made — edits
        included. Counted only while the app is on screen.
      </p>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
        {/* Today's clock ring */}
        <div className="flex shrink-0 flex-col items-center justify-center">
          <div className="relative h-40 w-40">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="workclock-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              {/* dial */}
              <circle cx="70" cy="70" r={R} fill="none" stroke="#eef2ff" strokeWidth="11" />
              {/* hour marks */}
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * 2 * Math.PI;
                const x1 = 70 + (R - 9) * Math.cos(a);
                const y1 = 70 + (R - 9) * Math.sin(a);
                const x2 = 70 + (R - 13) * Math.cos(a);
                const y2 = 70 + (R - 13) * Math.sin(a);
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round" />
                );
              })}
              {/* worked-time arc */}
              <circle
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke="url(#workclock-grad)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress)}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold tracking-tight text-slate-800">
                {formatDuration(todaySeconds)}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                worked today
              </span>
            </div>
          </div>
          <span className="mt-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            ✍ {data?.todayEntries ?? 0} entr{(data?.todayEntries ?? 0) === 1 ? "y" : "ies"} today
          </span>
        </div>

        {/* Last 7 days */}
        <div className="min-w-0 flex-1 self-center">
          <div className="space-y-2">
            {days.map((d, i) => {
              const isToday = i === days.length - 1;
              const seconds = isToday ? d.seconds + tick : d.seconds;
              const w = Math.max(seconds > 0 ? 4 : 0, Math.round((seconds / maxSeconds) * 100));
              return (
                <div key={d.day} className="group flex items-center gap-3">
                  <span
                    className={`w-10 shrink-0 text-xs ${
                      isToday ? "font-bold text-brand-700" : "font-medium text-slate-400"
                    }`}
                  >
                    {isToday ? "Today" : d.label}
                  </span>
                  <div className="relative h-3.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                    {w > 0 && (
                      <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${
                          isToday
                            ? "from-brand-600 to-violet-500"
                            : "from-brand-500/70 to-violet-400/70 group-hover:from-brand-500 group-hover:to-violet-400"
                        }`}
                        style={{ width: `${w}%` }}
                      />
                    )}
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs font-bold text-slate-700">
                    {formatDuration(seconds)}
                  </span>
                  <span
                    className={`w-20 shrink-0 text-right text-[11px] font-semibold ${
                      d.entries.total > 0 ? "text-emerald-600" : "text-slate-300"
                    }`}
                  >
                    {d.entries.total} entr{d.entries.total === 1 ? "y" : "ies"}
                  </span>
                </div>
              );
            })}
            {days.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-300">
                The work clock starts counting as soon as this update is live.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
