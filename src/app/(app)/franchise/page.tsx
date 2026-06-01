"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";

type Franchise = { id: string; name: string; _count?: { shops: number } };
type ShopRow = {
  shopId: string;
  name: string;
  code?: string | null;
  isActive: boolean;
  totalSales: number;
  salesCount: number;
  totalPurchases: number;
  totalReceivable: number;
  lowStockCount: number;
  itemCount: number;
};
type Report = {
  shopCount: number;
  totals: {
    totalSales: number;
    totalPurchases: number;
    totalReceivable: number;
    salesCount: number;
    lowStockCount: number;
  };
  bestShop: { shopId: string; name: string; totalSales: number } | null;
  shops: ShopRow[];
};

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

export default function FranchisePage() {
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [fName, setFName] = useState("");
  const [shop, setShop] = useState({ name: "", code: "", gstin: "", phone: "" });

  async function loadFranchises() {
    const r = await api<{ franchises: Franchise[] }>("/api/franchise");
    setFranchises(r.franchises);
    if (r.franchises[0] && !selected) setSelected(r.franchises[0].id);
  }
  useEffect(() => {
    loadFranchises();
  }, []);

  useEffect(() => {
    if (!selected) {
      setReport(null);
      return;
    }
    api<Report>(`/api/franchise/${selected}/report`)
      .then(setReport)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load report"));
  }, [selected]);

  async function createFranchise(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ franchise: Franchise }>("/api/franchise", {
        method: "POST",
        body: { name: fName },
      });
      setCreateOpen(false);
      setFName("");
      await loadFranchises();
      setSelected(r.franchise.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed");
    }
  }

  async function addShop(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api(`/api/franchise/${selected}/shops`, { method: "POST", body: shop });
      setShopOpen(false);
      setShop({ name: "", code: "", gstin: "", phone: "" });
      const r = await api<Report>(`/api/franchise/${selected}/report`);
      setReport(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Franchise"
        action={
          <div className="flex gap-2">
            {franchises.length > 0 && (
              <select
                className="input w-auto"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {franchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            {selected && (
              <button className="btn-secondary" onClick={() => setShopOpen(true)}>
                + Open Shop
              </button>
            )}
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              + New Franchise
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!selected && (
        <div className="card text-gray-500">
          Create a franchise to roll up sales and stock across all your shops.
        </div>
      )}

      {report && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Total Sales (chain)" value={formatMoney(report.totals.totalSales)} />
            <Kpi label="Total Purchases" value={formatMoney(report.totals.totalPurchases)} />
            <Kpi label="Receivables" value={formatMoney(report.totals.totalReceivable)} />
            <Kpi label="Low-stock items" value={String(report.totals.lowStockCount)} />
          </div>

          {report.bestShop && (
            <div className="card mb-6 flex items-center justify-between">
              <span className="text-sm text-gray-500">🏆 Best-performing shop</span>
              <span className="font-semibold">
                {report.bestShop.name} · {formatMoney(report.bestShop.totalSales)}
              </span>
            </div>
          )}

          <div className="card p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th">Shop</th>
                    <th className="table-th text-right">Sales</th>
                    <th className="table-th text-right">Bills</th>
                    <th className="table-th text-right">Purchases</th>
                    <th className="table-th text-right">Receivable</th>
                    <th className="table-th text-right">Products</th>
                    <th className="table-th text-right">Low stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.shops.map((s) => (
                    <tr key={s.shopId}>
                      <td className="table-td font-medium">
                        {s.name}
                        {s.code ? <span className="ml-1 text-xs text-gray-400">{s.code}</span> : null}
                      </td>
                      <td className="table-td text-right">{formatMoney(s.totalSales)}</td>
                      <td className="table-td text-right">{s.salesCount}</td>
                      <td className="table-td text-right">{formatMoney(s.totalPurchases)}</td>
                      <td className="table-td text-right">{formatMoney(s.totalReceivable)}</td>
                      <td className="table-td text-right">{s.itemCount}</td>
                      <td className="table-td text-right">
                        <span className={s.lowStockCount > 0 ? "font-semibold text-red-600" : ""}>
                          {s.lowStockCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {report.shops.length === 0 && (
                    <tr>
                      <td className="table-td text-gray-400" colSpan={7}>
                        No shops yet. Use “Open Shop” to add your first branch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {createOpen && (
        <Modal title="New Franchise" onClose={() => setCreateOpen(false)}>
          <form onSubmit={createFranchise} className="space-y-4">
            <div>
              <label className="label">Franchise / brand name</label>
              <input
                className="input"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Create
              </button>
            </div>
          </form>
        </Modal>
      )}

      {shopOpen && (
        <Modal title="Open New Shop" onClose={() => setShopOpen(false)}>
          <form onSubmit={addShop} className="space-y-4">
            <div>
              <label className="label">Shop name</label>
              <input
                className="input"
                value={shop.name}
                onChange={(e) => setShop({ ...shop, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Shop code</label>
                <input
                  className="input"
                  value={shop.code}
                  onChange={(e) => setShop({ ...shop, code: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={shop.phone}
                  onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">GSTIN / TRN</label>
              <input
                className="input"
                value={shop.gstin}
                onChange={(e) => setShop({ ...shop, gstin: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShopOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Open Shop
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
