import { db } from "@/db/database";
import { clearSettingsCache, DEFAULT_SETTINGS } from "@/db/settings";
import type { BackupData, Bill, BillItem, Customer, Payment, Product, AppSettings, StockMovement } from "@/types";
import { downloadJson } from "./csv";

const BACKUP_VERSION = 1;

function ymd(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function exportBackup(): Promise<void> {
  const [products, customers, bills, billItems, payments, settings, stockMovements] =
    await Promise.all([
      db.products.toArray(),
      db.customers.toArray(),
      db.bills.toArray(),
      db.billItems.toArray(),
      db.payments.toArray(),
      db.settings.toArray(),
      db.stockMovements.toArray(),
    ]);
  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    products,
    customers,
    bills,
    billItems,
    payments,
    settings,
    stockMovements,
  };
  downloadJson(backup, `IMRAN-ARAIN-KARYANA-BACKUP-${ymd()}.json`);
}

export function validateBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== "object") return false;
  const b = data as Record<string, unknown>;
  if (!Array.isArray(b.products)) return false;
  if (!Array.isArray(b.customers)) return false;
  if (!Array.isArray(b.bills)) return false;
  if (!Array.isArray(b.billItems)) return false;
  if (!Array.isArray(b.payments)) return false;
  if (!Array.isArray(b.stockMovements)) return false;
  if (!Array.isArray(b.settings)) return false;
  if (typeof b.version !== "number") return false;
  return true;
}

export async function importBackup(
  file: File
): Promise<{ products: number; customers: number; bills: number; payments: number }> {
  if (!file) throw new Error("No file selected.");
  if (file.size > 100 * 1024 * 1024) {
    throw new Error("Backup file is too large (max 100 MB).");
  }
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON. The selected file is not a valid backup.");
  }
  if (!validateBackup(data)) {
    throw new Error(
      "Invalid backup file. It must contain products, customers, bills, billItems, payments, settings and stockMovements."
    );
  }

  const { products, customers, bills, billItems, payments, settings, stockMovements } = data as BackupData;

  await db.transaction(
    "rw",
    [db.products, db.customers, db.bills, db.billItems, db.payments, db.settings, db.stockMovements],
    async () => {
      await Promise.all([db.products.clear(), db.customers.clear(), db.bills.clear(), db.billItems.clear(), db.payments.clear(), db.stockMovements.clear(), db.settings.clear()]);

      if (products.length) await db.products.bulkAdd(products as Product[]);
      if (customers.length) await db.customers.bulkAdd(customers as Customer[]);
      if (bills.length) await db.bills.bulkAdd(bills as Bill[]);
      if (billItems.length) await db.billItems.bulkAdd(billItems as BillItem[]);
      if (payments.length) await db.payments.bulkAdd(payments as Payment[]);
      if (stockMovements.length) await db.stockMovements.bulkAdd(stockMovements as StockMovement[]);

      const settingsRows = settings.filter((s) => s && typeof s === "object" && (s as { key?: string }).key);
      if (settingsRows.length) {
        await db.settings.bulkAdd(settingsRows as AppSettings[]);
      } else {
        await db.settings.add({ ...DEFAULT_SETTINGS });
      }
    }
  );

  clearSettingsCache();

  return {
    products: products.length,
    customers: customers.length,
    bills: bills.length,
    payments: payments.length,
  };
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.products, db.customers, db.bills, db.billItems, db.payments, db.settings, db.stockMovements],
    async () => {
      await db.products.clear();
      await db.customers.clear();
      await db.bills.clear();
      await db.billItems.clear();
      await db.payments.clear();
      await db.stockMovements.clear();
      await db.settings.clear();
    }
  );
  clearSettingsCache();
}