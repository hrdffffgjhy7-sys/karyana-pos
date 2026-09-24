import type { AppSettings, Bill, BillItem } from "@/types";
import { formatNumber, formatDateTime } from "./format";
import { getLogo } from "./logo";

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInvoiceHtml(
  settings: AppSettings,
  bill: Bill,
  items: BillItem[],
  logo: string
): string {
  const width = settings.receiptSize === "A4" ? 190 : settings.receiptSize === "80mm" ? 80 : 58;
  const isA4 = settings.receiptSize === "A4";
  const is58 = settings.receiptSize === "58mm";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(bill.invoiceNo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
  .page { width: ${width}mm; margin: 0 auto; padding: ${isA4 ? "12mm 0" : is58 ? "3mm 2mm" : "4mm 3mm"}; }
  .center { text-align: center; }
  .store { font-weight: 700; font-size: ${isA4 ? "18px" : is58 ? "13px" : "15px"}; letter-spacing: 0.03em; }
  .sub { font-size: ${isA4 ? "13px" : is58 ? "10px" : "11px"}; margin-top: 1mm; }
  .divider { border-top: 1px dashed #000; margin: 2.5mm 0; }
  .bold { font-weight: 700; }
  .row { display: flex; justify-content: space-between; width: 100%; }
  .mono { font-variant-numeric: tabular-nums; }
  table.items { width: 100%; border-collapse: collapse; font-size: ${isA4 ? "13px" : is58 ? "9px" : "10.5px"}; margin: 2mm 0; }
  table.items th { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 1.2mm 0.5mm; text-align: left; }
  table.items td { padding: 1.2mm 0.5mm; }
  .t { text-align: right; }
  @media print {
    @page { size: ${isA4 ? "A4" : `${width}mm auto`}; margin: ${isA4 ? "0" : "0 auto"}; }
    html, body { width: ${width}mm; }
  }
</style>
</head>
<body>
<div class="page">
  ${
    logo
      ? `<div class="center"><img src="${logo}" style="max-height:${isA4 ? "60px" : "32px"}; max-width:${isA4 ? "60px" : "30px"};" /></div>`
      : ""
  }
  <div class="center store">${escapeHtml(settings.storeName)}</div>
  <div class="center sub">${escapeHtml(settings.address || "")}</div>
  <div class="center sub">${escapeHtml(settings.phone ? `Phone: ${settings.phone}` : "")}</div>
  <div class="divider"></div>
  <div class="row"><span class="bold">Bill No:</span><span class="bold mono">${escapeHtml(bill.invoiceNo)}</span></div>
  <div class="row"><span>Date:</span><span class="mono">${formatDateTime(bill.date)}</span></div>
  ${
    bill.customerName && bill.customerName !== "Walk-in Customer"
      ? `<div class="row"><span>Customer:</span><span>${escapeHtml(bill.customerName)}</span></div>`
      : ""
  }
  ${
    bill.customerPhone
      ? `<div class="row"><span>Phone:</span><span>${escapeHtml(bill.customerPhone)}</span></div>`
      : ""
  }
  <table class="items">
    <thead><tr><th>Item</th><th>Qty</th><th class="t">Rate</th><th class="t">Amount</th></tr></thead>
    <tbody>
      ${items
        .map(
          (it) =>
            `<tr>
              <td>${escapeHtml(it.name)}</td>
              <td>${formatNumber(it.quantity)}${it.unit ? " " + escapeHtml(it.unit) : ""}</td>
              <td class="t mono">${formatNumber(it.unitPrice)}</td>
              <td class="t mono">${formatNumber(it.total)}</td>
            </tr>`
        )
        .join("")}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="row"><span>Subtotal:</span><span class="mono">Rs. ${formatNumber(bill.subtotal)}</span></div>
  <div class="row"><span>Discount:</span><span class="mono">Rs. ${formatNumber(bill.discount)}</span></div>
  ${
    bill.previousBalance > 0
      ? `<div class="row"><span>Previous Balance:</span><span class="mono">Rs. ${formatNumber(bill.previousBalance)}</span></div>`
      : ""
  }
  <div class="row bold"><span>Grand Total:</span><span class="mono">Rs. ${formatNumber(bill.grandTotal)}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Paid:</span><span class="mono">Rs. ${formatNumber(bill.paid)}</span></div>
  <div class="row bold"><span>Remaining:</span><span class="mono">Rs. ${formatNumber(bill.remainingBalance)}</span></div>
  <div class="divider"></div>
  <div class="center sub">Thank you for shopping with ${escapeHtml(settings.storeName)}</div>
</div>
</body>
</html>`;
}

export async function printInvoice(
  settings: AppSettings,
  bill: Bill,
  items: BillItem[]
): Promise<void> {
  const logo = await getLogo(settings);
  const html = buildInvoiceHtml(settings, bill, items, logo || "");
  const win = window.open("", "_blank", "width=420,height=600");
  if (!win) {
    throw new Error("Pop-up blocked. Please allow pop-ups to print the bill.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 350);
}