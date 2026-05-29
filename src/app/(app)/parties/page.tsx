"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Party = {
  id: string;
  name: string;
  type: "CUSTOMER" | "SUPPLIER";
  phone?: string;
  email?: string;
  gstin?: string;
  billingAddress?: string;
  openingBalance: string;
};

const empty = {
  name: "",
  type: "CUSTOMER" as const,
  phone: "",
  email: "",
  gstin: "",
  billingAddress: "",
  openingBalance: 0,
};

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await api<{ parties: Party[] }>("/api/parties");
    setParties(r.parties);
  }
  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(p: Party) {
    setEditing(p);
    setForm({ ...p, openingBalance: Number(p.openingBalance) });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, openingBalance: Number(form.openingBalance) };
      if (editing) {
        await api(`/api/parties/${editing.id}`, { method: "PUT", body });
      } else {
        await api("/api/parties", { method: "POST", body });
      }
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Party) {
    if (!confirm(`Delete ${p.name}?`)) return;
    await api(`/api/parties/${p.id}`, { method: "DELETE" });
    await load();
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader
        title="Parties"
        action={
          <button onClick={openNew} className="btn-primary">
            + Add Party
          </button>
        }
      />

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Type</th>
                <th className="table-th">Phone</th>
                <th className="table-th">GSTIN</th>
                <th className="table-th text-right">Opening Bal.</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parties.map((p) => (
                <tr key={p.id}>
                  <td className="table-td font-medium">{p.name}</td>
                  <td className="table-td">{p.type}</td>
                  <td className="table-td">{p.phone || "—"}</td>
                  <td className="table-td">{p.gstin || "—"}</td>
                  <td className="table-td text-right">
                    {formatMoney(p.openingBalance)}
                  </td>
                  <td className="table-td text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="mr-3 text-brand hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(p)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {parties.length === 0 && (
                <tr>
                  <td className="table-td text-gray-400" colSpan={6}>
                    No parties yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal title={editing ? "Edit Party" : "Add Party"} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={set("name")} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type} onChange={set("type")}>
                  <option value="CUSTOMER">Customer</option>
                  <option value="SUPPLIER">Supplier</option>
                </select>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={set("phone")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Email</label>
                <input className="input" value={form.email} onChange={set("email")} />
              </div>
              <div>
                <label className="label">GSTIN</label>
                <input className="input" value={form.gstin} onChange={set("gstin")} />
              </div>
            </div>
            <div>
              <label className="label">Billing Address</label>
              <textarea
                className="input"
                rows={2}
                value={form.billingAddress}
                onChange={set("billingAddress")}
              />
            </div>
            <div>
              <label className="label">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.openingBalance}
                onChange={set("openingBalance")}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
