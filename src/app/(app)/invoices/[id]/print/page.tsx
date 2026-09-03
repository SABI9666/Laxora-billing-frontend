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
  returnedQty?: string;
  rate: string;
  taxRate: string;
  amount: string;
  createdAt?: string;
  item?: { hsn?: string | null; unit?: string | null; sku?: string | null } | null;
};
type ReturnLine = {
  description: string;
  quantity: number;
  rate: number;
  taxRate: number;
  amount: number;
  total: number;
};
type Return = {
  id: string;
  date: string;
  reason?: string | null;
  refundMethod?: string | null;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  lines: ReturnLine[];
  exchangeItemIds: string[];
};
type Payment = {
  id: string;
  paymentDate: string;
  amount: string;
  method: string;
  direction: "IN" | "OUT";
  purpose?: string | null;
};
type Invoice = {
  id: string;
  invoiceNumber: string;
  type: "SALE" | "PURCHASE";
  status: string;
  invoiceDate: string;
  createdAt?: string;
  subtotal: string;
  discount: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  returnedAmount?: number;
  refundedAmount?: number;
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
  returns?: Return[];
  payments?: Payment[];
};
type Business = {
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const qtyText = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");

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

  const isSale = invoice.type === "SALE";
  const tax = Number(invoice.taxAmount);
  const paid = Number(invoice.amountPaid);
  const returned = Number(invoice.returnedAmount ?? 0);
  const refunded = Number(invoice.refundedAmount ?? 0);
  const returns = invoice.returns ?? [];
  const payments = [...(invoice.payments ?? [])].sort(
    (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
  );
  // A settling payment goes the party's usual way (customer pays IN, we pay a
  // supplier OUT); the opposite direction is money handed back.
  const settleDir = isSale ? "IN" : "OUT";

  const exactTotal = Number(invoice.total);
  // Round the bill to the nearest rupee like a standard GST tax invoice.
  const total = Math.round(exactTotal);
  const roundOff = round2(total - exactTotal);
  // What the party finally has to pay for this bill: the bill after every
  // addition, less what came back.
  const netPayable = round2(total - returned);
  // What is still owed: net bill, less money received, plus any refund that
  // was handed back (that money is owed again).
  const balance = round2(netPayable - paid + refunded);
  const settled = balance <= 0.009;

  // Intra-state GST is split equally into CGST + SGST.
  const halfTax = tax / 2;
  const totalQty = invoice.items.reduce((s, l) => s + Number(l.quantity), 0);
  // If every line has the same GST rate, show the CGST/SGST percentage.
  const rateSet = new Set(invoice.items.map((l) => Number(l.taxRate)));
  const halfRate = rateSet.size === 1 ? [...rateSet][0] / 2 : null;
  const cgstLabel = halfRate != null ? `CGST @ ${halfRate}%` : "CGST";
  const sgstLabel = halfRate != null ? `SGST @ ${halfRate}%` : "SGST";

  // Lines put on the bill after it was raised ("+ Add") or by an exchange are
  // tagged so the customer can see the bill grew and when.
  const raisedAt = new Date(invoice.createdAt ?? invoice.invoiceDate).getTime();
  const addedCutoff = raisedAt + 10 * 60 * 1000;
  const exchangeOn = new Map<string, string>();
  for (const r of returns) for (const iid of r.exchangeItemIds ?? []) exchangeOn.set(iid, r.date);
  const lineTag = (l: Line): string | null => {
    const ex = exchangeOn.get(l.id);
    if (ex) return `Exchange · ${formatDate(ex)}`;
    if (l.createdAt && new Date(l.createdAt).getTime() > addedCutoff)
      return `Added · ${formatDate(l.createdAt)}`;
    return null;
  };
  const hasAdjustments = returns.length > 0 || invoice.items.some((l) => lineTag(l));

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
          {isSale ? "Tax Invoice" : "Purchase Invoice"}
        </p>

        {/* Invoice + customer details */}
        <div className="flex justify-between gap-6 border-b border-gray-300 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">
              {isSale ? "Billed To" : "Supplier"}
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
              <span className={`font-bold ${settled ? "text-green-700" : "text-red-600"}`}>
                {settled ? "PAID" : paid + refunded > 0.009 ? "PARTIALLY PAID" : "UNPAID"}
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
              const tag = lineTag(l);
              const retQty = Number(l.returnedQty ?? 0);
              return (
                <tr key={l.id} className="border-b border-gray-200 align-top">
                  <td className="py-1.5 pr-1">{i + 1}</td>
                  <td className="py-1.5 pr-2 font-medium">
                    {l.description}
                    {tag && (
                      <span className="ml-1.5 rounded border border-gray-400 px-1 text-[9px] font-semibold uppercase text-gray-600">
                        {tag}
                      </span>
                    )}
                    {l.item?.sku && (
                      <span className="block text-[10px] font-normal text-gray-500">
                        Code: {l.item.sku}
                      </span>
                    )}
                    {retQty > 0 && (
                      <span className="block text-[10px] font-normal text-gray-500">
                        ↩ {qtyText(retQty)} {unit} returned — see Returns below
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">{l.item?.hsn || "—"}</td>
                  <td className="py-1.5 pr-2 text-center">{gst}%</td>
                  <td className="py-1.5 pr-2 text-right">
                    {qtyText(Number(l.quantity))} {unit}
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
              <td className="py-1.5 text-right">{qtyText(round2(totalQty))} NOS</td>
              <td colSpan={3} />
              <td className="py-1.5 text-right">{formatMoney(invoice.subtotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* Returns & exchanges — what came back, so the net bill is explained */}
        {returns.length > 0 && (
          <div className="mt-4">
            <p className="border-b border-gray-800 pb-1 text-xs font-bold uppercase tracking-wide">
              Returns &amp; Exchanges on this bill
            </p>
            {returns.map((r, ri) => (
              <div key={r.id} className="mt-2">
                <div className="flex flex-wrap justify-between gap-x-4 text-[11px]">
                  <span>
                    <span className="font-semibold">
                      {r.exchangeItemIds?.length ? "Exchange" : "Return"} #{ri + 1}
                    </span>
                    <span className="text-gray-500"> · {formatDate(r.date)}</span>
                    {r.reason && <span className="text-gray-500"> · {r.reason}</span>}
                  </span>
                  <span className="text-gray-500">
                    {r.refundMethod
                      ? `Refunded by ${r.refundMethod.toLowerCase()}`
                      : "Adjusted against this bill"}
                    {r.exchangeItemIds?.length
                      ? " · replacement goods are marked “Exchange” above"
                      : ""}
                  </span>
                </div>
                <table className="mt-1 w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-gray-300 text-left uppercase text-gray-500">
                      <th className="py-1 pr-2">Goods returned</th>
                      <th className="py-1 pr-2 text-center">GST</th>
                      <th className="py-1 pr-2 text-right">Qty</th>
                      <th className="py-1 pr-2 text-right">Rate</th>
                      <th className="py-1 text-right">Amount (Incl. Tax)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.map((l, li) => (
                      <tr key={li} className="border-b border-gray-100">
                        <td className="py-1 pr-2">{l.description}</td>
                        <td className="py-1 pr-2 text-center">{l.taxRate}%</td>
                        <td className="py-1 pr-2 text-right">{qtyText(l.quantity)}</td>
                        <td className="py-1 pr-2 text-right">{formatMoney(l.rate)}</td>
                        <td className="py-1 text-right">{formatMoney(l.total)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="py-1 pr-2" colSpan={4}>
                        Return value
                      </td>
                      <td className="py-1 text-right">− {formatMoney(r.totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div className="mt-3 flex justify-end">
          <table className="w-80 text-sm">
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
              <tr
                className={`border-t-2 border-gray-800 ${
                  returned > 0 ? "font-semibold" : "text-base font-extrabold"
                }`}
              >
                <td className="py-1.5">{returned > 0 ? "Bill Total" : "Grand Total"}</td>
                <td className="py-1.5 text-right">{formatMoney(total)}</td>
              </tr>
              {returned > 0 && (
                <>
                  <tr>
                    <td className="py-0.5 text-gray-500">Less: Returns</td>
                    <td className="py-0.5 text-right">− {formatMoney(returned)}</td>
                  </tr>
                  <tr className="border-t-2 border-gray-800 text-base font-extrabold">
                    <td className="py-1.5">Net Payable</td>
                    <td className="py-1.5 text-right">{formatMoney(netPayable)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td className="py-0.5 text-gray-500">{isSale ? "Received" : "Paid"}</td>
                <td className="py-0.5 text-right">− {formatMoney(paid)}</td>
              </tr>
              {refunded > 0 && (
                <tr>
                  <td className="py-0.5 text-gray-500">Refunded back</td>
                  <td className="py-0.5 text-right">+ {formatMoney(refunded)}</td>
                </tr>
              )}
              {balance > 0.009 ? (
                <tr className="border-t border-gray-400 font-bold text-red-600">
                  <td className="py-1">Balance Due</td>
                  <td className="py-1 text-right">{formatMoney(balance)}</td>
                </tr>
              ) : (
                <tr className="border-t border-gray-400 font-bold text-green-700">
                  <td className="py-1">{balance < -0.009 ? "Excess paid" : "Balance Due"}</td>
                  <td className="py-1 text-right">{formatMoney(Math.abs(balance))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Amount in words — the final figure the party has to pay */}
        <p className="mt-3 border-t border-gray-300 pt-2 text-sm">
          <span className="text-gray-500">
            {returned > 0 ? "Net payable in words: " : "Amount in words: "}
          </span>
          <span className="font-semibold italic">{amountInWords(Math.round(netPayable))}</span>
        </p>

        {/* Payment history — every receipt and refund on this bill */}
        {payments.length > 0 && (
          <div className="mt-3">
            <p className="border-b border-gray-800 pb-1 text-xs font-bold uppercase tracking-wide">
              Payment History
            </p>
            <table className="mt-1 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-gray-300 text-left uppercase text-gray-500">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Particulars</th>
                  <th className="py-1 pr-2">Mode</th>
                  <th className="py-1 pr-2 text-right">{isSale ? "Received" : "Paid"}</th>
                  <th className="py-1 text-right">Refunded</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const settles = p.direction === settleDir;
                  return (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-1 pr-2">{formatDate(p.paymentDate)}</td>
                      <td className="py-1 pr-2">
                        {settles
                          ? p.purpose || (isSale ? "Payment received" : "Payment made")
                          : p.purpose || "Refund"}
                      </td>
                      <td className="py-1 pr-2">{p.method}</td>
                      <td className="py-1 pr-2 text-right">
                        {settles ? formatMoney(p.amount) : "—"}
                      </td>
                      <td className="py-1 text-right">{settles ? "—" : formatMoney(p.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {hasAdjustments && (
          <p className="mt-2 text-[10px] text-gray-500">
            Lines marked “Added” were put on this bill after it was raised; lines marked
            “Exchange” replaced returned goods. The Net Payable is the bill after all
            additions and returns.
          </p>
        )}

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
