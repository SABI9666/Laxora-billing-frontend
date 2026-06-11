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

  const total = Number(invoice.total);
  const tax = Number(invoice.taxAmount);
  const paid = Number(invoice.amountPaid);
  const balance = total - paid;
  // Intra-state GST is split equally into CGST + SGST.
  const halfTax = tax / 2;

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

        {/* Items table */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800 text-left text-xs uppercase">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Item Description</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Rate</th>
              <th className="py-2 pr-2 text-right">GST %</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((l, i) => (
              <tr key={l.id} className="border-b border-gray-200">
                <td className="py-1.5 pr-2">{i + 1}</td>
                <td className="py-1.5 pr-2 font-medium">{l.description}</td>
                <td className="py-1.5 pr-2 text-right">{Number(l.quantity)}</td>
                <td className="py-1.5 pr-2 text-right">{formatMoney(l.rate)}</td>
                <td className="py-1.5 pr-2 text-right">{Number(l.taxRate)}%</td>
                <td className="py-1.5 text-right">{formatMoney(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-3 flex justify-end">
          <table className="w-64 text-sm">
            <tbody>
              <tr>
                <td className="py-0.5 text-gray-500">Subtotal</td>
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
                    <td className="py-0.5 text-gray-500">CGST</td>
                    <td className="py-0.5 text-right">{formatMoney(halfTax)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-gray-500">SGST</td>
                    <td className="py-0.5 text-right">{formatMoney(halfTax)}</td>
                  </tr>
                </>
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
