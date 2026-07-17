"use client";

// Special reminder banner + popup.
//
// Super Admin broadcasts "special reminders" into a shared Supabase table
// (`special_reminders`). This component reads that table directly from
// Supabase's auto-generated REST API using the public anon key, so no change
// to the Laxora backend is needed. An active notice pops up once per session
// and stays pinned as a banner until Super Admin deletes (or pauses) it.
//
// A notice can target a single shop (by name) or every shop. When it targets
// a shop, we only show it if that matches the shop the user is currently in.

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getBusinessId } from "@/lib/api";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const POLL_MS = 60_000; // re-check every minute so deletions clear quickly
const ACK_KEY = "laxora_special_ack"; // ids acknowledged this session (popup)

type SpecialReminder = {
  id: string;
  title: string | null;
  message: string;
  level: "info" | "warning" | "urgent" | string;
  target_shop: string | null;
  active: boolean | null;
  created_at: string;
};

type Membership = {
  business: { id: string; name: string; code?: string | null };
};

type LevelStyle = {
  icon: string;
  label: string;
  banner: string;
  accent: string;
  button: string;
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

// Forgiving shop-name comparison: case-insensitive, whitespace-collapsed,
// and matches when either name contains the other (so "Pradeeksha
// Technologies" set in Super Admin still matches "Pradeeksha Technologies
// Shop" in Laxora, and vice-versa).
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
function shopMatches(target: string, mine: string[]): boolean {
  const t = norm(target);
  if (!t) return true;
  return mine.some((m) => {
    const n = norm(m);
    return n.length > 0 && (n === t || n.includes(t) || t.includes(n));
  });
}

export default function SpecialReminder() {
  const [items, setItems] = useState<SpecialReminder[]>([]);
  const [popup, setPopup] = useState<SpecialReminder | null>(null);
  // Names of the shop the user is currently in (name + code). null = not
  // resolved yet — we hold shop-targeted notices until we know the shop.
  const [myShop, setMyShop] = useState<string[] | null>(null);

  // Resolve the current shop once.
  useEffect(() => {
    let cancelled = false;
    api<{ user: { memberships: Membership[] } }>("/api/auth/me")
      .then((r) => {
        if (cancelled) return;
        const ms = r.user?.memberships || [];
        const activeId = getBusinessId();
        const active =
          ms.find((m) => m.business.id === activeId)?.business ??
          ms[0]?.business;
        const names: string[] = [];
        if (active?.name) names.push(active.name);
        if (active?.code) names.push(active.code);
        setMyShop(names);
      })
      .catch(() => {
        if (!cancelled) setMyShop([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      setItems(
        Array.isArray(data) ? data.filter((d) => d.active !== false) : []
      );
    } catch {
      /* network hiccup — keep whatever we have */
    }
  }, []);

  useEffect(() => {
    fetchReminders();
    const t = setInterval(fetchReminders, POLL_MS);
    return () => clearInterval(t);
  }, [fetchReminders]);

  // Notices this shop should actually see.
  const visible = useMemo(() => {
    return items.filter((r) => {
      const target = (r.target_shop || "").trim();
      if (!target) return true; // all-shops notice
      if (myShop === null) return false; // shop unknown yet — hold it
      return shopMatches(target, myShop);
    });
  }, [items, myShop]);

  // Pop up the newest visible notice not yet acknowledged this session.
  useEffect(() => {
    if (popup) return;
    const acked = getAcked();
    const fresh = visible.find((d) => !acked.has(d.id));
    if (fresh) setPopup(fresh);
  }, [visible, popup]);

  const dismissPopup = () => {
    if (popup) {
      const acked = getAcked();
      acked.add(popup.id);
      setAcked(acked);
    }
    setPopup(null);
  };

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (visible.length === 0) return null;

  return (
    <>
      {/* Persistent banner(s) — stay until Super Admin removes the notice */}
      <div className="sticky top-0 z-40 flex flex-col gap-px">
        {visible.map((r) => {
          const s = levelStyle(r.level);
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm shadow-sm ${s.banner}`}
              role="status"
            >
              <span className="text-base leading-none">{s.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">
                  {r.title || s.label}:{" "}
                </span>
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
