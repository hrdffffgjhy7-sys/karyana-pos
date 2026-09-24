import { db } from "./database";
import type { AppSettings } from "@/types";

export const DEFAULT_SETTINGS: AppSettings = {
  key: "default",
  storeName: "IMRAN ARAIN KARYANA",
  ownerName: "Imran Arain",
  phone: "0300-0000000",
  whatsapp: "923000000000",
  address: "Main Bazaar, Your City, Pakistan",
  currency: "PKR",
  currencySymbol: "Rs.",
  invoicePrefix: "IAK",
  startingInvoiceNumber: "0001",
  receiptSize: "80mm",
  allowNegativeStock: false,
  logo: null,
  billWhatsappTemplate: [
    "Assalam-o-Alaikum,",
    "",
    "Thank you for shopping at {STORE_NAME}.",
    "",
    "Bill No: {INVOICE_NO}",
    "",
    "Items:",
    "{ITEMS}",
    "",
    "Subtotal: Rs. {SUBTOTAL}",
    "Discount: Rs. {DISCOUNT}",
    "Total: Rs. {TOTAL}",
    "Paid: Rs. {PAID}",
    "Remaining: Rs. {REMAINING}",
    "",
    "Thank you for shopping with us.",
  ].join("\n"),
  udhaarWhatsappTemplate: [
    "Assalam-o-Alaikum,",
    "",
    "Your current outstanding balance at {STORE_NAME} is:",
    "",
    "Rs. {BALANCE}",
    "",
    "Please clear your balance when convenient.",
    "",
    "JazakAllah.",
  ].join("\n"),
};

let cache: AppSettings | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (cache) return cache;
  const row = await db.settings.where("key").equals("default").first();
  if (!row) {
    await db.settings.add({ ...DEFAULT_SETTINGS });
    cache = { ...DEFAULT_SETTINGS };
    return cache;
  }
  cache = { ...DEFAULT_SETTINGS, ...row };
  return cache;
}

export async function saveSettings(
  patch: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch, key: "default" };
  const row = await db.settings.where("key").equals("default").first();
  if (row && row.id) {
    await db.settings.put({ ...next, id: row.id });
  } else {
    await db.settings.add(next);
  }
  cache = { ...next, id: cache?.id };
  return cache;
}

export async function clearSettingsCache() {
  cache = null;
}