"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/invoices", label: "Invoices", icon: "🧾" },
  { href: "/parties", label: "Parties", icon: "👥" },
  { href: "/items", label: "Items", icon: "📦" },
  { href: "/payments", label: "Payments", icon: "💰" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="px-6 py-5 text-xl font-bold text-brand">Laxora</div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                active
                  ? "bg-brand-light text-brand"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={logout}
        className="m-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        🚪 Logout
      </button>
    </aside>
  );
}
