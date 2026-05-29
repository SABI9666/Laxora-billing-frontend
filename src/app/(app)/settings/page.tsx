"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

type Business = {
  id: string;
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
};

export default function SettingsPage() {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ business: Business }>("/api/business").then((r) =>
      setForm({
        name: r.business.name || "",
        gstin: r.business.gstin || "",
        phone: r.business.phone || "",
        email: r.business.email || "",
        address: r.business.address || "",
        logoUrl: r.business.logoUrl || "",
      })
    );
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<any>) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved(false);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/business", { method: "PUT", body: form });
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
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
