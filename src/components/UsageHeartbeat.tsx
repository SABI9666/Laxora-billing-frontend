"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { startActivityTracking, isActivelyWorking } from "@/lib/activity";

// Tells the backend "the shop is working in the app right now" once a minute.
// A minute counts when the tab is on screen AND the user has interacted with
// the app recently — clicking menus, typing, scrolling all keep the clock
// running; leaving the app open untouched does not. Powers the dashboard's
// "time worked in application" clock.
export default function UsageHeartbeat() {
  useEffect(() => {
    startActivityTracking();
    const ping = () => {
      if (!isActivelyWorking()) return;
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
