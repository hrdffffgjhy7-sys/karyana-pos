import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  AppSettings,
  Bill,
  BillItem,
  Customer,
  Payment,
  Product,
} from "@/types";
import { formatNumber, formatDateTime } from "./format";
import { loadImage, getLogo } from "./logo";
import { downloadFile, sanitizeFilename } from "./utils";

type ReceiptSize = AppSettings["receiptSize"];

async function resolveLogo(settings: AppSettings): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const data = await getLogo(settings);
    if (!data) return null;
    const img = await loadImage(data);
    const max = settings.receiptSize === "A4" ? 22 : 14;
    const scale = Math.min(max / img.width, max / img.height, 1);
    return { data, w: img.width * scale, h: img.height * scale };
  } catch {
    return null;
  }
}

interface PdfConfig {
  size: ReceiptSize;
  unit: "mm";
  format: [number, number];
  marginX: number;
  headerFont: number;
  baseFont: number;
  lineHeight: number;
}

function getConfig(size: ReceiptSize): PdfConfig {
  if (size === "58mm") {
    return { size, unit: "mm", format: [58, 297], marginX: 4, headerFont: 10, baseFont: 8, lineHeight: 3.6 };
  }
  if (size === "80mm") {
    return { size, unit: "mm", format: [80, 297], marginX: 5, headerFont: 12, baseFont: 8.5, lineHeight: 4 };
  }
  return { size, unit: "mm", format: [210, 297], marginX: 14, headerFont: 16, baseFont: 10, lineHeight: 5 };
}

export async function generateInvoicePDF(
  bill: Bill,
  items: BillItem[],
  settings: AppSettings
): Promise<void> {
  const cfg = getConfig(settings.receiptSize || "A4");
  const doc = new jsPDF({ orientation: "portrait", unit: cfg.unit, format: cfg.format });
  const pageW = doc.internal.pageSize.getWidth();
  const cx = pageW / 2;
  let y = 6;

  const logo = await resolveLogo(settings);

  if (logo) {
    try {
      doc.addImage(logo.data, "PNG", cx - logo.w / 2, y, logo.w, logo.h);
      y += logo.h + cfg.lineHeight;
    } catch {
      y += cfg.lineHeight;
    }
  }

  const headerSize = cfg.size === "A4" ? 16 : cfg.headerFont;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headerSize);
  doc.text(settings.storeName, cx, y, { align: "center" });
  y += cfg.lineHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(cfg.headerFont);
  if (settings.address) {
    doc.text(settings.address, cx, y, { align: "center", maxWidth: pageW - 2 * cfg.marginX });
    y += cfg.lineHeight;
  }
  if (settings.phone) {
    doc.text(`Phone: ${settings.phone}`, cx, y, { align: "center" });
    y += cfg.lineHeight;
  }
  y += 2;
  doc.setDrawColor(120);
  doc.setLineWidth(0.3);
  doc.line(cfg.marginX, y, pageW - cfg.marginX, y);
  y += cfg.lineHeight;

  doc.setFont("helvetica", "bold");
  doc.text(`Bill No: ${bill.invoiceNo}`, cx, y, { align: "center" });
  y += cfg.lineHeight;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(cfg.baseFont);
  doc.text(`Date: ${formatDateTime(bill.date)}`, cx, y, { align: "center" });
  y += cfg.lineHeight + 2;

  if (bill.customerName && bill.customerName !== "Walk-in Customer") {
    doc.text(`Customer: ${bill.customerName}`, cfg.marginX, y);
    y += cfg.lineHeight;
    if (bill.customerPhone) {
      doc.text(`Phone: ${bill.customerPhone}`, cfg.marginX, y);
      y += cfg.lineHeight;
    }
    y += 2;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: cfg.marginX, right: cfg.marginX },
    theme: "grid",
    styles: { fontSize: cfg.baseFont, cellPadding: cfg.size === "A4" ? 2 : 1, textColor: [30, 30, 30] },
    headStyles: { fillColor: [21, 83, 45], textColor: [255, 255, 255], fontSize: cfg.baseFont, fontStyle: "bold" },
    head: [["Item", "Qty", "Rate", "Amount"]],
    body: items.map((it) => [
      it.name,
      `${formatNumber(it.quantity)}${it.unit ? " " + it.unit : ""}`,
      formatNumber(it.unitPrice),
      formatNumber(it.total),
    ]),
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: cfg.size === "A4" ? 24 : 12, halign: "center" },
      2: { cellWidth: cfg.size === "A4" ? 24 : 13, halign: "right" },
      3: { cellWidth: cfg.size === "A4" ? 26 : 15, halign: "right" },
    },
  });

  let afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + cfg.lineHeight;
  const leftX = cfg.marginX;
  const rightX = pageW - cfg.marginX;

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(cfg.baseFont + (bold ? 0.5 : 0));
    doc.text(label, leftX, afterY);
    doc.text(value, rightX, afterY, { align: "right" });
    afterY += cfg.lineHeight;
  };

  totalRow("Subtotal:", `Rs. ${formatNumber(bill.subtotal)}`);
  totalRow("Discount:", `Rs. ${formatNumber(bill.discount)}`);
  if (bill.previousBalance > 0) totalRow("Previous Balance:", `Rs. ${formatNumber(bill.previousBalance)}`);
  totalRow("Grand Total:", `Rs. ${formatNumber(bill.grandTotal)}`, true);
  doc.setDrawColor(120);
  doc.line(leftX, afterY - 1, rightX, afterY - 1);
  totalRow("Paid:", `Rs. ${formatNumber(bill.paid)}`);
  totalRow("Remaining:", `Rs. ${formatNumber(bill.remainingBalance)}`, true);

  afterY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(cfg.baseFont);
  doc.text(`Thank you for shopping with ${settings.storeName}`, cx, afterY, { align: "center", maxWidth: pageW - 2 * cfg.marginX });

  const filename = `IMRAN-ARAIN-${bill.invoiceNo}-${sanitizeFilename(bill.customerName)}.pdf`;
  const blob = doc.output("blob");
  downloadFile(blob, filename);
}

export async function generateStatementPDF(
  customer: Customer,
  transactions: {
    type: "bill" | "payment";
    date: number;
    invoiceNo: string;
    amount: number;
    method: string;
    items: { name: string; quantity: number; unitPrice: number }[];
  }[],
  currentBalance: number,
  settings: AppSettings
): Promise<void> {
  const cfg = getConfig("A4");
  const doc = new jsPDF({ orientation: "portrait", unit: cfg.unit, format: cfg.format });
  const pageW = doc.internal.pageSize.getWidth();
  const cx = pageW / 2;
  let y = 10;

  const data = await getLogo(settings);
  if (data) {
    try {
      const img = await loadImage(data);
      const scale = Math.min(16 / img.width, 16 / img.height);
      doc.addImage(data, "PNG", cx - (img.width * scale) / 2, y, img.width * scale, img.height * scale);
      y += img.height * scale + 4;
    } catch { /* ignore */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings.storeName, cx, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Account Statement", cx, y, { align: "center" });
  y += 8;

  doc.setFontSize(cfg.baseFont);
  doc.text(`Customer: ${customer.name}`, cfg.marginX, y);
  y += 5;
  if (customer.phone) {
    doc.text(`Phone: ${customer.phone}`, cfg.marginX, y);
    y += 5;
  }
  y += 3;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Date", "Invoice", "Type", "Amount", "Balance"]],
    body: transactions.map((t) => [
      formatDateTime(t.date),
      t.invoiceNo || "-",
      t.type === "bill" ? "Bill" : `Payment (${t.method})`,
      `Rs. ${formatNumber(t.amount)}`,
      "",
    ]),
    headStyles: { fillColor: [21, 83, 45], textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 38 },
      3: { halign: "right" },
    },
  });

  let fy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.text("Current Balance:", cfg.marginX, fy);
  doc.text(`Rs. ${formatNumber(currentBalance)}`, pageW - cfg.marginX, fy, { align: "right" });

  const filename = `IMRAN-ARAIN-CUSTOMER-STATEMENT-${sanitizeFilename(customer.name)}.pdf`;
  downloadFile(doc.output("blob"), filename);
}

export function generateSalesReportPDF(
  meta: {
    title: string;
    range: string;
    totalBills: number;
    totalSales: number;
    totalReceived: number;
    totalDiscount: number;
    totalOutstanding: number;
  },
  daily: { label: string; sales: number; bills: number }[],
  topProducts: { name: string; quantity: number; amount: number }[],
  customerSales: { name: string; amount: number; bills: number }[],
  settings: AppSettings
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const cx = pageW / 2;
  let y = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings.storeName, cx, y, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text("Sales Report", cx, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Period: ${meta.range}`, cx, y, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Summary", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const rows: [string, string][] = [
    ["Total Bills", formatNumber(meta.totalBills)],
    ["Total Sales", `Rs. ${formatNumber(meta.totalSales)}`],
    ["Total Received", `Rs. ${formatNumber(meta.totalReceived)}`],
    ["Total Outstanding", `Rs. ${formatNumber(meta.totalOutstanding)}`],
    ["Total Discount", `Rs. ${formatNumber(meta.totalDiscount)}`],
  ];
  for (const [k, v] of rows) {
    doc.text(k, 14, y);
    doc.text(v, pageW - 14, y, { align: "right" });
    y += 5;
  }

  y += 4;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Date", "Sales", "Bills"]],
    body: daily.map((d) => [d.label, `Rs. ${formatNumber(d.sales)}`, formatNumber(d.bills)]),
    headStyles: { fillColor: [21, 83, 45], textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Top Products", "Qty Sold", "Amount"]],
    body: topProducts.map((p) => [p.name, formatNumber(p.quantity), `Rs. ${formatNumber(p.amount)}`]),
    headStyles: { fillColor: [21, 83, 45], textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Customer", "Bills", "Amount"]],
    body: customerSales.map((c) => [c.name, formatNumber(c.bills), `Rs. ${formatNumber(c.amount)}`]),
    headStyles: { fillColor: [21, 83, 45], textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
  });

  const filename = `IMRAN-ARAIN-SALES-REPORT-${meta.range.replace(/[/ ]/g, "-")}.pdf`;
  downloadFile(doc.output("blob"), filename);
}

export function generateProductsPDF(
  products: Product[],
  settings: AppSettings,
  filterLabel = "All"
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const cx = pageW / 2;
  let y = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings.storeName, cx, y, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text(`Product Inventory — ${filterLabel} (${products.length} items)`, cx, y, { align: "center" });
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Product", "SKU", "Barcode", "Category", "Purchase", "Selling", "Stock", "Min Stock", "Unit"]],
    body: products.map((p) => [
      p.name,
      p.sku || "-",
      p.barcode || "-",
      p.category || "-",
      formatNumber(p.purchasePrice),
      formatNumber(p.sellingPrice),
      formatNumber(p.stock),
      formatNumber(p.minStock),
      p.unit,
    ]),
    headStyles: { fillColor: [21, 83, 45], textColor: [255, 255, 255] },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: 60 } },
  });

  const filename = `IMRAN-ARAIN-PRODUCTS-${filterLabel.replace(/[^a-zA-Z0-9-]+/g, "-")}.pdf`;
  downloadFile(doc.output("blob"), filename);
}

export function generateUdhaarReportPDF(
  rows: {
    name: string;
    phone: string;
    balance: number;
    purchases: number;
    paid: number;
  }[],
  totalOutstanding: number,
  settings: AppSettings
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const cx = pageW / 2;
  let y = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings.storeName, cx, y, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text("Udhaar Report", cx, y, { align: "center" });
  y += 5;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Customer", "Phone", "Purchases", "Paid", "Outstanding"]],
    body: rows.map((r) => [
      r.name,
      r.phone || "-",
      `Rs. ${formatNumber(r.purchases)}`,
      `Rs. ${formatNumber(r.paid)}`,
      `Rs. ${formatNumber(r.balance)}`,
    ]),
    headStyles: { fillColor: [21, 83, 45], textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    foot: [["Total", "", "", "", `Rs. ${formatNumber(totalOutstanding)}`]],
    footStyles: { fillColor: [240, 253, 244], textColor: [20, 83, 45], fontStyle: "bold" },
  });

  const filename = "IMRAN-ARAIN-UDHAAR-REPORT.pdf";
  downloadFile(doc.output("blob"), filename);
}

export function generatePaymentsLogPDF(
  payments: Payment[],
  settings: AppSettings
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const cx = pageW / 2;
  let y = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings.storeName, cx, y, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text("Payments Log", cx, y, { align: "center" });
  y += 5;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Date", "Customer", "Invoice", "Method", "Amount"]],
    body: payments.map((p) => [
      formatDateTime(p.date),
      p.customerName || "-",
      p.invoiceNo || (p.type === "standalone" ? "Payment" : "-"),
      p.method,
      `Rs. ${formatNumber(p.amount)}`,
    ]),
    headStyles: { fillColor: [21, 83, 45], textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
  });

  const filename = "IMRAN-ARAIN-PAYMENTS-LOG.pdf";
  downloadFile(doc.output("blob"), filename);
}