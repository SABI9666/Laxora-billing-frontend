"use client";

// Special reminder banner + popup.
//
// Super Admin broadcasts "special reminders" into a shared Supabase table
// (`special_reminders`). This component reads that table directly from
// Supabase's auto-generated REST API using the public anon key, so no change
// to the Laxora backend is needed. An active notice pops up once per session
// and stays pinned as a banner until Super Admin deletes (or pauses) it.

import { useCallback, useEffect, useState } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const POLL_MS = 60_000; // re-check every minute so deletions clear quickly
const ACK_KEY = "laxora_special_ack"; // ids acknowledged this session (popup)

type SpecialReminder = {
  id: string;
  title: string | null;
  message: string;
  level: "info" | "warning" | "urgent" | string;
  active: boolean | null;
  created_at: string;
};

type LevelStyle = {
  icon: string;
  label: string;
  banner: string; // banner background + text
  accent: string; // popup icon circle
  button: string; // popup dismiss button
};

const LEVELS: Record<string, LevelStyle> = {
  info: {
    icon: "ℹ️",
    label: "Notice",
    banner: "bg-indigo-600 text-white",
    accent: "bg-indigo-100 text-indigo-700",
    button: "bg-indigo-600 hover:bg-indigo-700 text-white",
  },
  warning: {
    icon: "⚠️",
    label: "Important",
    banner: "bg-amber-500 text-white",
    accent: "bg-amber-100 text-amber-700",
    button: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  urgent: {
    icon: "🚨",
    label: "Urgent",
    banner: "bg-red-600 text-white",
    accent: "bg-red-100 text-red-700",
    button: "bg-red-600 hover:bg-red-700 text-white",
  },
};

function levelStyle(level: string): LevelStyle {
  return LEVELS[level] || LEVELS.info;
}

function getAcked(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(ACK_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function setAcked(ids: Set<string>) {
  try {
    sessionStorage.setItem(ACK_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export default function SpecialReminder() {
  const [items, setItems] = useState<SpecialReminder[]>([]);
  const [popup, setPopup] = useState<SpecialReminder | null>(null);

  const fetchReminders = useCallback(async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return; // feature not configured
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/special_reminders?select=*&active=eq.true&order=created_at.desc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          cache: "no-store",
        }
      );
      if (!res.ok) return;
      const data: SpecialReminder[] = await res.json();
      const active = Array.isArray(data)
        ? data.filter((d) => d.active !== false)
        : [];
      setItems(active);

      // Pop up the newest notice that hasn't been acknowledged this session.
      const acked = getAcked();
      const fresh = active.find((d) => !acked.has(d.id));
      setPopup((cur) => cur ?? fresh ?? null);
    } catch {
      /* network hiccup — keep whatever we have */
    }
  }, []);

  useEffect(() => {
    fetchReminders();
    const t = setInterval(fetchReminders, POLL_MS);
    return () => clearInterval(t);
  }, [fetchReminders]);

  const dismissPopup = () => {
    if (popup) {
      const acked = getAcked();
      acked.add(popup.id);
      setAcked(acked);
    }
    setPopup(null);
  };

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (items.length === 0) return null;

  return (
    <>
      {/* Persistent banner(s) — stay until Super Admin removes the notice */}
      <div className="sticky top-0 z-40 flex flex-col gap-px">
        {items.map((r) => {
          const s = levelStyle(r.level);
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm shadow-sm ${s.banner}`}
              role="status"
            >
              <span className="text-base leading-none">{s.icon}</span>
              <span className="min-w-0 flex-1">
                {r.title ? (
                  <span className="font-semibold">{r.title}: </span>
                ) : (
                  <span className="font-semibold">{s.label}: </span>
                )}
                <span className="opacity-95">{r.message}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* One-time popup for the newest notice */}
      {popup && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={dismissPopup}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex flex-col items-center px-6 pt-8 text-center">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
                  levelStyle(popup.level).accent
                }`}
              >
                {levelStyle(popup.level).icon}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900">
                {popup.title || levelStyle(popup.level).label}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                {popup.message}
              </p>
            </div>
            <div className="px-6 pb-6 pt-6">
              <button
                onClick={dismissPopup}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  levelStyle(popup.level).button
                }`}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
