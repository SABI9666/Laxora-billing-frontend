"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

// Tells the backend "the app is open right now" once a minute while this tab
// is visible. The backend adds the minutes up per day, which powers the
// "time worked in application" clock on the dashboard.
export default function UsageHeartbeat() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      api("/api/usage/heartbeat", { method: "POST" }).catch(() => {
        // Ignore — an offline blip must never disturb the user's work.
      });
    };
    ping(); // count the first minute right away
    const id = setInterval(ping, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
