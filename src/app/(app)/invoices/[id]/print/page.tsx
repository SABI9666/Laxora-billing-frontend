"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import { amountInWords } from "@/lib/numberToWords";

type Line = {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  taxRate: string;
  amount: string;
  item?: { hsn?: string | null; unit?: string | null; sku?: string | null } | null;
};
type Invoice = {
  id: string;
  invoiceNumber: string;
  type: "SALE" | "PURCHASE";
  status: string;
  invoiceDate: string;
  subtotal: string;
  discount: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  notes?: string | null;
  estimateNo?: string | null;
  party: {
    name: string;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    billingAddress?: string | null;
  };
  items: Line[];
};
type Business = {
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    api<{ invoice: Invoice }>(`/api/invoices/${id}`).then((r) => setInvoice(r.invoice));
    api<{ business: Business }>("/api/business").then((r) => setBusiness(r.business));
  }, [id]);

  if (!invoice || !business)
    return <div className="p-8 text-gray-400">Loading invoice…</div>;

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const tax = Number(invoice.taxAmount);
  const paid = Number(invoice.amountPaid);
  const exactTotal = Number(invoice.total);
  // Round the bill to the nearest rupee like a standard GST tax invoice.
  const total = Math.round(exactTotal);
  const roundOff = round2(total - exactTotal);
  const balance = total - paid;
  // Intra-state GST is split equally into CGST + SGST.
  const halfTax = tax / 2;
  const totalQty = invoice.items.reduce((s, l) => s + Number(l.quantity), 0);
  // If every line has the same GST rate, show the CGST/SGST percentage.
  const rateSet = new Set(invoice.items.map((l) => Number(l.taxRate)));
  const halfRate = rateSet.size === 1 ? [...rateSet][0] / 2 : null;
  const cgstLabel = halfRate != null ? `CGST @ ${halfRate}%` : "CGST";
  const sgstLabel = halfRate != null ? `SGST @ ${halfRate}%` : "SGST";

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hide app chrome when printing */}
      <style>{`
        @media print {
          aside, .no-print { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .invoice-sheet { border: none !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="btn-secondary">
          ← Back
        </button>
        <button onClick={() => window.print()} className="btn-primary">
          🖨️ Print / Save as PDF
        </button>
      </div>

      <div className="invoice-sheet rounded-xl border border-gray-300 bg-white p-8 text-[13px] leading-relaxed text-gray-900">
        {/* Shop header */}
        <div className="border-b-2 border-gray-800 pb-4 text-center">
          <h1 className="text-2xl font-extrabold uppercase tracking-wide">{business.name}</h1>
          {business.address && <p className="mt-1">{business.address}</p>}
          <p>
            {business.phone && <>Ph: {business.phone}</>}
            {business.phone && business.email && " · "}
            {business.email}
          </p>
          {business.gstin && <p className="font-semibold">GSTIN: {business.gstin}</p>}
        </div>

        <p className="border-b border-gray-300 py-1.5 text-center text-sm font-bold uppercase tracking-widest">
          {invoice.type === "SALE" ? "Tax Invoice" : "Purchase Invoice"}
        </p>

        {/* Invoice + customer details */}
        <div className="flex justify-between gap-6 border-b border-gray-300 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">
              {invoice.type === "SALE" ? "Billed To" : "Supplier"}
            </p>
            <p className="text-base font-bold">{invoice.party?.name}</p>
            {invoice.party?.billingAddress && <p>{invoice.party.billingAddress}</p>}
            {invoice.party?.phone && <p>Ph: {invoice.party.phone}</p>}
            {invoice.party?.gstin && <p>GSTIN: {invoice.party.gstin}</p>}
          </div>
          <div className="text-right">
            <p>
              <span className="text-gray-500">Invoice No: </span>
              <span className="font-bold">{invoice.invoiceNumber}</span>
            </p>
            <p>
              <span className="text-gray-500">Date: </span>
              <span className="font-semibold">{formatDate(invoice.invoiceDate)}</span>
            </p>
            {invoice.estimateNo && (
              <p>
                <span className="text-gray-500">Estimate No: </span>
                <span className="font-semibold">{invoice.estimateNo}</span>
              </p>
            )}
            <p>
              <span className="text-gray-500">Status: </span>
              <span
                className={`font-bold ${
                  invoice.status === "PAID" ? "text-green-700" : "text-red-600"
                }`}
              >
                {invoice.status}
              </span>
            </p>
          </div>
        </div>

        {/* Items table — GST tax-invoice layout */}
        <table className="mt-3 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-gray-800 text-left uppercase">
              <th className="py-2 pr-1">#</th>
              <th className="py-2 pr-2">Description of Goods</th>
              <th className="py-2 pr-2">HSN/SAC</th>
              <th className="py-2 pr-2 text-center">GST</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">
                Rate<br />
                <span className="font-normal normal-case">(Incl. Tax)</span>
              </th>
              <th className="py-2 pr-2 text-right">Rate</th>
              <th className="py-2 pr-1">per</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((l, i) => {
              const exRate = Number(l.rate);
              const gst = Number(l.taxRate);
              const inclRate = round2(exRate * (1 + gst / 100));
              const unit = l.item?.unit || "NOS";
              return (
                <tr key={l.id} className="border-b border-gray-200 align-top">
                  <td className="py-1.5 pr-1">{i + 1}</td>
                  <td className="py-1.5 pr-2 font-medium">
                    {l.description}
                    {l.item?.sku && (
                      <span className="block text-[10px] font-normal text-gray-500">
                        Code: {l.item.sku}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">{l.item?.hsn || "—"}</td>
                  <td className="py-1.5 pr-2 text-center">{gst}%</td>
                  <td className="py-1.5 pr-2 text-right">
                    {Number(l.quantity)} {unit}
                  </td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(inclRate)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatMoney(exRate)}</td>
                  <td className="py-1.5 pr-1">{unit}</td>
                  <td className="py-1.5 text-right">{formatMoney(l.amount)}</td>
                </tr>
              );
            })}
            {/* Totals row: total quantity + taxable value */}
            <tr className="border-t-2 border-gray-800 font-bold">
              <td className="py-1.5" colSpan={4}>
                Total
              </td>
              <td className="py-1.5 text-right">{round2(totalQty)} NOS</td>
              <td colSpan={3} />
              <td className="py-1.5 text-right">{formatMoney(invoice.subtotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-3 flex justify-end">
          <table className="w-72 text-sm">
            <tbody>
              <tr>
                <td className="py-0.5 text-gray-500">Taxable Value</td>
                <td className="py-0.5 text-right">{formatMoney(invoice.subtotal)}</td>
              </tr>
              {Number(invoice.discount) > 0 && (
                <tr>
                  <td className="py-0.5 text-gray-500">Discount</td>
                  <td className="py-0.5 text-right">− {formatMoney(invoice.discount)}</td>
                </tr>
              )}
              {tax > 0 && (
                <>
                  <tr>
                    <td className="py-0.5 text-gray-500">{cgstLabel}</td>
                    <td className="py-0.5 text-right">{formatMoney(halfTax)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-gray-500">{sgstLabel}</td>
                    <td className="py-0.5 text-right">{formatMoney(halfTax)}</td>
                  </tr>
                </>
              )}
              {Math.abs(roundOff) >= 0.005 && (
                <tr>
                  <td className="py-0.5 text-gray-500">Round Off</td>
                  <td className="py-0.5 text-right">
                    {roundOff > 0 ? "+" : "−"} {formatMoney(Math.abs(roundOff))}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-800 text-base font-extrabold">
                <td className="py-1.5">Grand Total</td>
                <td className="py-1.5 text-right">{formatMoney(total)}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-gray-500">Paid</td>
                <td className="py-0.5 text-right">{formatMoney(paid)}</td>
              </tr>
              {balance > 0.009 && (
                <tr className="font-bold text-red-600">
                  <td className="py-0.5">Balance Due</td>
                  <td className="py-0.5 text-right">{formatMoney(balance)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Amount in words */}
        <p className="mt-3 border-t border-gray-300 pt-2 text-sm">
          <span className="text-gray-500">Amount in words: </span>
          <span className="font-semibold italic">{amountInWords(total)}</span>
        </p>

        {invoice.notes && (
          <p className="mt-2 text-sm">
            <span className="text-gray-500">Notes: </span>
            {invoice.notes}
          </p>
        )}

        {/* Footer */}
        <div className="mt-10 flex items-end justify-between">
          <p className="text-xs text-gray-500">
            Goods once sold are subject to our standard return policy. E. &amp; O. E.
          </p>
          <div className="text-center">
            <div className="mb-1 h-10 w-44 border-b border-gray-400" />
            <p className="text-xs font-semibold">For {business.name}</p>
            <p className="text-[10px] text-gray-500">Authorised Signatory</p>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          Thank you for your business! · Generated by Laxora Billing
        </p>
      </div>
    </div>
  );
}
