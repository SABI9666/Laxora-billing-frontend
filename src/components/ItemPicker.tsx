"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

export type PickerItem = {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  price?: number | null;
  stock?: number | null;
  low?: boolean;
};

// A professional, accessible product picker: type any part of the name or SKU
// to filter, navigate with ↑/↓, pick with Enter, close with Esc. Each row shows
// the price and live stock (low stock in red). Replaces the plain <select>.
export default function ItemPicker({
  items,
  value,
  onSelect,
  placeholder = "Search product by name or SKU…",
}: {
  items: PickerItem[];
  value: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = items.find((it) => it.id === value);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const term = q.trim().toLowerCase();
  const filtered = (
    term
      ? items.filter((it) => `${it.name} ${it.sku ?? ""}`.toLowerCase().includes(term))
      : items
  ).slice(0, 60);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelectorAll<HTMLElement>("[data-opt]")[active];
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
    setQ("");
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[active];
      if (it) choose(it.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <input
        className="input pr-7"
        placeholder={placeholder}
        value={open ? q : selected?.name ?? ""}
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKey}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
        {open ? "🔍" : "▾"}
      </span>

      {open && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 max-h-72 w-full min-w-[16rem] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-400 hover:bg-slate-50"
            onClick={() => choose("")}
          >
            ✎ Custom line / clear
          </button>
          {filtered.map((it, i) => (
            <button
              key={it.id}
              type="button"
              data-opt
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(it.id)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition ${
                i === active ? "bg-brand-light" : "hover:bg-slate-50"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {it.name}
                </span>
                {(it.sku || it.unit) && (
                  <span className="block truncate text-xs text-slate-400">
                    {it.sku ? `SKU ${it.sku}` : ""}
                    {it.sku && it.unit ? " · " : ""}
                    {it.unit ? `per ${it.unit}` : ""}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end">
                {it.price != null && (
                  <span className="text-sm font-semibold text-slate-700">
                    {formatMoney(it.price)}
                  </span>
                )}
                {it.stock != null && (
                  <span
                    className={`text-xs ${
                      it.low ? "font-semibold text-red-600" : "text-slate-400"
                    }`}
                  >
                    {it.stock} in stock
                  </span>
                )}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400">No products match “{q}”.</div>
          )}
        </div>
      )}
    </div>
  );
}
