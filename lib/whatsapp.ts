import type { AppSettings, Bill, BillItem, Customer } from "@/types";
import { formatNumber } from "./format";
import { renderTemplate } from "./logo";

export function buildBillWhatsApp(
  settings: AppSettings,
  bill: Bill,
  items: BillItem[]
): string {
  const border = "--------------------";
  const itemLines = items
    .map(
      (it) =>
        `${it.name} × ${formatNumber(it.quantity)} — Rs. ${formatNumber(it.total)}`
    )
    .join("\n");

  return renderTemplate(settings.billWhatsappTemplate, {
    STORE_NAME: settings.storeName,
    INVOICE_NO: bill.invoiceNo,
    ITEMS: itemLines
      ? `${border}\n${itemLines}\n${border}`
      : border,
    SUBTOTAL: formatNumber(bill.subtotal),
    DISCOUNT: formatNumber(bill.discount),
    TOTAL: formatNumber(bill.grandTotal),
    PAID: formatNumber(bill.paid),
    REMAINING: formatNumber(bill.remainingBalance),
  });
}

export function buildUdhaarReminder(
  settings: AppSettings,
  customer: Customer,
  balance: number
): string {
  return renderTemplate(settings.udhaarWhatsappTemplate, {
    STORE_NAME: settings.storeName,
    CUSTOMER_NAME: customer.name,
    BALANCE: formatNumber(balance),
  });
}

export function normalizeWhatsAppNumber(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "92" + digits.slice(1);
  return digits;
}

export function openWhatsApp(phone: string, message: string): boolean {
  const wa = normalizeWhatsAppNumber(phone);
  if (!wa) return false;
  window.open(
    `https://wa.me/${wa}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer"
  );
  return true;
}

export function billMessagePreview(
  settings: AppSettings,
  bill: Bill,
  items: BillItem[]
): string {
  return buildBillWhatsApp(settings, bill, items);
}