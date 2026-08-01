"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession } from "@/lib/api";
import ShopSwitcher from "@/components/ShopSwitcher";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/pos", label: "POS / Sell", icon: "🛒" },
  { href: "/invoices", label: "Invoices", icon: "🧾" },
  { href: "/online-orders", label: "Online Orders", icon: "🌐" },
  { href: "/items", label: "Products", icon: "💡" },
  { href: "/categories", label: "Categories", icon: "🏷️" },
  { href: "/stock", label: "Stock", icon: "📦" },
  { href: "/parties", label: "Customers & Suppliers", icon: "👥" },
  { href: "/payments", label: "Payments", icon: "💰" },
  { href: "/ledgers", label: "Ledgers", icon: "📒" },
  { href: "/expenses", label: "Expenses", icon: "💸" },
  { href: "/gst", label: "GST Filing", icon: "🧮" },
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
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-black text-white shadow-sm">
          L
        </div>
        <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          Laxora
        </span>
      </div>

      <ShopSwitcher />

      <p className="px-5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Menu
      </p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-brand-light text-brand shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-[15px] transition ${
                  active ? "bg-white/70" : "bg-slate-100 group-hover:bg-white"
                }`}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[15px]">
            ⎋
          </span>
          Logout
        </button>
      </div>
    </aside>
  );
}
