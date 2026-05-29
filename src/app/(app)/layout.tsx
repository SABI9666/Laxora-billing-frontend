"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

// Auth guard + app shell for all signed-in pages.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-8">{children}</main>
    </div>
  );
}
