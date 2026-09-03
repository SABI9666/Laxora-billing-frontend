"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

// WhatsApp wants an international number without "+" or spaces. Indian
// 10-digit numbers get the 91 country code; a leading 0 is dropped.
export function whatsappNumber(phone?: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return d.length >= 11 ? d : null;
}

type Props = {
  kind: "invoice" | "ledger";
  id: string;
  // The party's phone, if known — pre-fills the WhatsApp recipient.
  phone?: string | null;
  // Short title for the device share sheet.
  title: string;
  // Message body; the public link is appended on its own line.
  message: string;
  // Compact icon-only trigger for table rows.
  compact?: boolean;
};

// One button that turns a bill or statement into something the customer can
// open: mints a read-only public link, then offers WhatsApp, the device share
// sheet, copy link, or print / save as PDF.
export default function ShareMenu({ kind, id, phone, title, message, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function ensureLink(): Promise<string | null> {
    if (link) return link;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ path: string }>("/api/share", { method: "POST", body: { kind, id } });
      const url = `${window.location.origin}${r.path}`;
      setLink(url);
      return url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the link");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void ensureLink();
  }

  const fullText = (url: string) => `${message}\n\nView / download: ${url}`;

  async function onWhatsApp() {
    const url = await ensureLink();
    if (!url) return;
    const to = whatsappNumber(phone);
    const text = encodeURIComponent(fullText(url));
    window.open(
      to ? `https://wa.me/${to}?text=${text}` : `https://wa.me/?text=${text}`,
      "_blank",
      "noopener"
    );
    setOpen(false);
  }

  async function onCopy() {
    const url = await ensureLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  async function onNative() {
    const url = await ensureLink();
    if (!url) return;
    try {
      await navigator.share({ title, text: fullText(url) });
      setOpen(false);
    } catch {
      /* user dismissed the sheet */
    }
  }

  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const item =
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50";

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        title="Share"
        className={
          compact
            ? "mr-3 text-brand hover:underline"
            : "btn-secondary inline-flex items-center gap-1.5"
        }
      >
        {compact ? "Share" : <>📤 Share</>}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <button className={item} onClick={onWhatsApp} disabled={busy}>
            <span className="text-green-600">🟢</span>
            <span>
              WhatsApp
              {whatsappNumber(phone) ? (
                <span className="block text-xs text-slate-400">to {phone}</span>
              ) : (
                <span className="block text-xs text-slate-400">choose a contact</span>
              )}
            </span>
          </button>
          {canNative && (
            <button className={item} onClick={onNative} disabled={busy}>
              📱 Share via phone…
            </button>
          )}
          <button className={item} onClick={onCopy} disabled={busy}>
            🔗 {copied ? "Link copied!" : "Copy link"}
          </button>
          <button
            className={item}
            onClick={() => {
              setOpen(false);
              window.print();
            }}
          >
            🖨️ Print / Save as PDF
          </button>
          <div className="mt-1 border-t px-3 py-1.5 text-[11px] text-slate-400">
            {busy && "Preparing link…"}
            {error && <span className="text-red-600">{error}</span>}
            {!busy && !error && link && "Anyone with the link can view this. Valid for 1 year."}
          </div>
        </div>
      )}
    </div>
  );
}
