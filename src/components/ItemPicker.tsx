"use client";

import { useEffect, useRef, useState } from "react";

export type PickerItem = { id: string; name: string; sub?: string };

// A searchable product picker: type any part of the name to filter (works with
// pasted names too), then click to select. Replaces the plain <select>.
export default function ItemPicker({
  items,
  value,
  onSelect,
  placeholder = "Search / pick product…",
}: {
  items: PickerItem[];
  value: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
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
      ? items.filter((it) => `${it.name} ${it.sub ?? ""}`.toLowerCase().includes(term))
      : items
  ).slice(0, 50);

  return (
    <div className="relative" ref={ref}>
      <input
        className="input"
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
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50"
            onClick={() => {
              onSelect("");
              setOpen(false);
            }}
          >
            Custom / clear
          </button>
          {filtered.map((it) => (
            <button
              key={it.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              onClick={() => {
                onSelect(it.id);
                setOpen(false);
              }}
            >
              {it.name}
              {it.sub ? <span className="ml-1 text-xs text-gray-400">{it.sub}</span> : null}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">No products match “{q}”.</div>
          )}
        </div>
      )}
    </div>
  );
}
