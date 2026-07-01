"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

type Business = {
  id: string;
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  openingCash?: string;
  openingBank?: string;
  saleInvoicePrefix?: string | null;
  nextSaleNo?: number;
};

export default function SettingsPage() {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [copied, setCopied] = useState(false);

  function describeKeyError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        return "The billing backend is running an older version without the online store API. Redeploy the backend and apply the database changes (npx prisma db push), then try again.";
      }
      if (err.status === 403) {
        return "Your role on this shop does not allow managing the online store key (owner/admin/manager required).";
      }
      return `${err.message} (HTTP ${err.status})`;
    }
    return "Could not reach the billing backend. Check the API URL and try again.";
  }

  useEffect(() => {
    api<{ apiKey: string | null }>("/api/business/online-store-key")
      .then((r) => setApiKey(r.apiKey))
      .catch(() => {});
  }, []);

  async function generateKey() {
    if (
      apiKey &&
      !confirm(
        "Generate a new key? The website will stop syncing until you update it with the new key."
      )
    )
      return;
    setKeyBusy(true);
    setKeyError("");
    try {
      const r = await api<{ apiKey: string }>("/api/business/online-store-key", {
        method: "POST",
      });
      setApiKey(r.apiKey);
    } catch (err) {
      setKeyError(describeKeyError(err));
    } finally {
      setKeyBusy(false);
    }
  }

  async function disconnectKey() {
    if (!confirm("Disconnect the online store? Website stock sync and order billing will stop."))
      return;
    setKeyBusy(true);
    setKeyError("");
    try {
      await api("/api/business/online-store-key", { method: "DELETE" });
      setApiKey(null);
    } catch (err) {
      setKeyError(describeKeyError(err));
    } finally {
      setKeyBusy(false);
    }
  }

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    api<{ business: Business }>("/api/business").then((r) =>
      setForm({
        name: r.business.name || "",
        gstin: r.business.gstin || "",
        phone: r.business.phone || "",
        email: r.business.email || "",
        address: r.business.address || "",
        logoUrl: r.business.logoUrl || "",
        openingCash: Number(r.business.openingCash ?? 0),
        openingBank: Number(r.business.openingBank ?? 0),
        saleInvoicePrefix: r.business.saleInvoicePrefix ?? "",
        nextSaleNo: Number(r.business.nextSaleNo ?? 1),
      })
    );
  }, []);

  const [numSaving, setNumSaving] = useState(false);
  const [numSaved, setNumSaved] = useState(false);

  // Invoice numbering is saved separately so a normal profile save never
  // rolls back the running invoice counter.
  async function saveNumbering(e: React.FormEvent) {
    e.preventDefault();
    const next = Number(form.nextSaleNo);
    if (!Number.isInteger(next) || next < 1) {
      alert("Next invoice number must be a whole number of 1 or more.");
      return;
    }
    if (
      !confirm(
        `Set the next sale invoice to "${form.saleInvoicePrefix || "INV-"}${String(next).padStart(4, "0")}"? New bills will continue from here.`
      )
    )
      return;
    setNumSaving(true);
    setNumSaved(false);
    try {
      await api("/api/business", {
        method: "PUT",
        body: {
          saleInvoicePrefix: form.saleInvoicePrefix || "",
          nextSaleNo: next,
        },
      });
      setNumSaved(true);
    } finally {
      setNumSaving(false);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved(false);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Exclude invoice-numbering fields; they have their own save so a
      // profile save never rewinds the running counter.
      const { saleInvoicePrefix, nextSaleNo, ...profile } = form;
      await api("/api/business", {
        method: "PUT",
        body: {
          ...profile,
          openingCash: Number(form.openingCash) || 0,
          openingBank: Number(form.openingBank) || 0,
        },
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <div className="text-gray-400">Loading…</div>;

  return (
    <div>
      <PageHeader title="Business Settings" />
      <form onSubmit={save} className="card max-w-xl space-y-4">
        {saved && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Saved!
          </div>
        )}
        <div>
          <label className="label">Business Name</label>
          <input className="input" value={form.name} onChange={set("name")} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">GSTIN</label>
            <input className="input" value={form.gstin} onChange={set("gstin")} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={set("phone")} />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label className="label">Address</label>
          <textarea className="input" rows={3} value={form.address} onChange={set("address")} />
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input className="input" value={form.logoUrl} onChange={set("logoUrl")} />
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-1 text-sm font-semibold">Opening balances (cash book starting point)</p>
          <p className="mb-3 text-xs text-gray-400">
            Enter the cash in the shop and the money in the bank when you start using Laxora.
            The daily cash book builds on these.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Opening cash in shop</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.openingCash}
                onChange={set("openingCash")}
              />
            </div>
            <div>
              <label className="label">Opening bank balance</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.openingBank}
                onChange={set("openingBank")}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      <form onSubmit={saveNumbering} className="card mt-6 max-w-xl space-y-3">
        <p className="text-sm font-semibold">Sale Invoice Numbering</p>
        <p className="text-xs text-gray-400">
          Choose how sale (counter) invoice numbers look and where they continue from. Example:
          prefix <code>26-</code> with next number <code>27394</code> makes the next bill{" "}
          <b>26-27394</b>, then 26-27395, and so on. Leave the prefix blank to use{" "}
          <code>INV-</code>. This does not affect online orders (which use their own ONL- series).
        </p>
        {numSaved && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Saved! The next sale invoice will be{" "}
            <b>
              {(form.saleInvoicePrefix || "INV-") +
                String(Number(form.nextSaleNo) || 1).padStart(4, "0")}
            </b>
            .
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Invoice prefix</label>
            <input
              className="input"
              placeholder="e.g. 26-"
              value={form.saleInvoicePrefix}
              onChange={set("saleInvoicePrefix")}
            />
          </div>
          <div>
            <label className="label">Next invoice number</label>
            <input
              type="number"
              min={1}
              step={1}
              className="input"
              value={form.nextSaleNo}
              onChange={set("nextSaleNo")}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Preview:{" "}
          <b>
            {(form.saleInvoicePrefix || "INV-") +
              String(Number(form.nextSaleNo) || 1).padStart(4, "0")}
          </b>
        </p>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={numSaving}>
            {numSaving ? "Saving…" : "Save Numbering"}
          </button>
        </div>
      </form>

      <div className="card mt-6 max-w-xl space-y-3">
        <p className="text-sm font-semibold">Online Store (Laxorashopping website)</p>
        <p className="text-xs text-gray-400">
          Connect the shopping website to this shop&apos;s stock. The website shows this
          shop&apos;s live stock for matching products (matched by SKU or product name), and
          every paid website order automatically reduces stock here and creates a bill under
          the Online Orders menu.
        </p>
        {keyError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{keyError}</div>
        )}
        {apiKey ? (
          <>
            <div className="flex items-center gap-2">
              <input className="input flex-1 font-mono text-xs" value={apiKey} readOnly />
              <button type="button" className="btn-secondary" onClick={copyKey}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              In the website&apos;s Vercel project, set <code>LAXORA_BILLING_API_KEY</code> to
              this key and <code>LAXORA_BILLING_API_URL</code> to this billing API&apos;s URL,
              then redeploy the website.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={generateKey}
                disabled={keyBusy}
              >
                Regenerate Key
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={disconnectKey}
                disabled={keyBusy}
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={generateKey} disabled={keyBusy}>
            {keyBusy ? "Generating…" : "Connect Online Store"}
          </button>
        )}
      </div>
    </div>
  );
}
