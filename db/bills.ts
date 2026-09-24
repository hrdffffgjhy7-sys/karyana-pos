import { db } from "./database";
import { getSettings } from "./settings";
import type { Bill, BillItem, CreateBillInput, BillStatus } from "@/types";

export interface BillWithItems extends Bill {
  items: BillItem[];
}

export type DateRange = "today" | "yesterday" | "week" | "month" | "custom" | "all";

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export interface BillListFilter {
  range?: DateRange;
  from?: number;
  to?: number;
  search?: string;
}

export async function listBills(filter: BillListFilter = {}): Promise<Bill[]> {
  let bills: Bill[];
  const range = filter.range || "all";
  const now = new Date();

  const bounds = (() => {
    if (range === "today")
      return { from: startOfDay(now), to: startOfDay(new Date(now.getTime() + 86400000)) };
    if (range === "yesterday") {
      const y = new Date(now.getTime() - 86400000);
      return { from: startOfDay(y), to: startOfDay(now) };
    }
    if (range === "week") {
      const d = new Date(now);
      const day = (d.getDay() + 6) % 7;
      const monday = new Date(d.getTime() - day * 86400000);
      return { from: startOfDay(monday), to: startOfDay(new Date(now.getTime() + 86400000)) };
    }
    if (range === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { from: startOfDay(first), to: startOfDay(next) };
    }
    if (range === "custom")
      return { from: filter.from ?? 0, to: filter.to ?? Date.now() };
    return { from: 0, to: Date.now() + 86400000 };
  })();

  bills = await db.bills
    .where("date")
    .between(bounds.from, bounds.to, true, false)
    .reverse()
    .sortBy("date");

  if (filter.search) {
    const q = filter.search.toLowerCase();
    bills = bills.filter(
      (b) =>
        b.invoiceNo.toLowerCase().includes(q) ||
        (b.customerName || "").toLowerCase().includes(q) ||
        (b.customerPhone || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    );
  }
  return bills;
}

export async function getBillWithItems(id: number): Promise<BillWithItems | undefined> {
  const bill = await db.bills.get(id);
  if (!bill) return undefined;
  const items = await db.billItems.where("billId").equals(id).toArray();
  return { ...bill, items };
}

export async function getBillByInvoiceNo(invoiceNo: string): Promise<BillWithItems | undefined> {
  const bill = await db.bills.where("invoiceNo").equals(invoiceNo).first();
  if (!bill || !bill.id) return undefined;
  const items = await db.billItems.where("billId").equals(bill.id).toArray();
  return { ...bill, items };
}

export async function computeNextInvoiceNumber(): Promise<string> {
  const settings = await getSettings();
  const bills = await db.bills.toArray();
  let maxNumber = 0;
  for (const b of bills) {
    const m = /(\d+)$/.exec(b.invoiceNo);
    if (m) maxNumber = Math.max(maxNumber, parseInt(m[1], 10));
  }
  const starting = parseInt(settings.startingInvoiceNumber || "1", 10) || 1;
  const next = Math.max(maxNumber + 1, starting);
  return `${settings.invoicePrefix}-${String(next).padStart(4, "0")}`;
}

function getBillStatus(remaining: number, paid: number, grandTotal: number): BillStatus {
  if (remaining <= 0) return "Paid";
  if (paid > 0) return "Partial";
  return "Udhaar";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function createBill(input: CreateBillInput) {
  const settings = await getSettings();
  if (!input.items.length) throw new Error("Bill has no items.");

  const now = Date.now();
  const previousBalance = input.customerId
    ? await getCustomerRunningBalance(input.customerId)
    : 0;

  const subtotal = round2(
    input.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  );
  const discount = round2(Math.min(input.discount || 0, subtotal));
  const grandTotal = round2(subtotal - discount);
  const paid = round2(Math.min(input.paid, previousBalance + grandTotal) || 0);
  const remainingBalance = round2(previousBalance + grandTotal - paid);

  if (grandTotal < 0) throw new Error("Discount cannot make the total negative.");
  if (paid < 0) throw new Error("Paid amount cannot be negative.");
  if (input.paid !== 0 && input.paid > previousBalance + grandTotal + 0.001) {
    throw new Error("Paid amount is greater than the total due.");
  }

  if (!settings.allowNegativeStock) {
    for (const it of input.items) {
      if (it.stock < it.quantity) {
        throw new Error(`Insufficient stock for "${it.name}". Only ${it.stock} ${it.unit} available.`);
      }
    }
  }

  const invoiceNo = await computeNextInvoiceNumber();

  try {
    const billId = await db.transaction(
      "rw",
      db.bills,
      db.billItems,
      db.products,
      db.payments,
      db.stockMovements,
      async () => {
        const check = await db.bills.where("invoiceNo").equals(invoiceNo).first();
        if (check) throw new Error(`Invoice number ${invoiceNo} already exists. Please try again.`);

        // Decrement stock
        if (!settings.allowNegativeStock) {
          for (const it of input.items) {
            const prod = await db.products.get(it.productId);
            if (prod && prod.stock < it.quantity) {
              throw new Error(`Insufficient stock for "${it.name}".`);
            }
          }
        }
        for (const it of input.items) {
          const prod = await db.products.get(it.productId);
          if (prod) {
            const newStock = round2(prod.stock - it.quantity);
            await db.products.update(prod.id!, { stock: newStock, updatedAt: now });
            await db.stockMovements.add({
              productId: prod.id!,
              productName: prod.name,
              type: "sale",
              quantity: -it.quantity,
              note: `Bill ${invoiceNo}`,
              date: now,
            });
          }
        }

        const status = getBillStatus(remainingBalance, paid, grandTotal);
        const bill: Bill = {
          invoiceNo,
          customerId: input.customerId,
          customerName: input.customerName || "Walk-in Customer",
          customerPhone: input.customerPhone || "",
          date: now,
          itemsCount: input.items.reduce((s, it) => s + it.quantity, 0),
          subtotal,
          discount,
          previousBalance,
          grandTotal,
          paid,
          remainingBalance,
          paymentMethod: input.paymentMethod,
          status,
          createdAt: now,
        };
        const id = await db.bills.add(bill);

        for (const it of input.items) {
          const item: BillItem = {
            billId: id,
            productId: it.productId,
            name: it.name,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: round2(it.quantity * it.unitPrice),
            unit: it.unit,
          };
          await db.billItems.add(item);
        }

        if (paid > 0) {
          await db.payments.add({
            customerId: input.customerId,
            customerName: input.customerName || "Walk-in Customer",
            billId: id,
            invoiceNo,
            amount: paid,
            date: now,
            method: input.paymentMethod,
            note: `Payment for bill ${invoiceNo}`,
            type: "bill",
            createdAt: now,
          });
        }
        return id;
      }
    );

    const bill = await db.bills.get(billId);
    return { bill, invoiceNo, newBalance: remainingBalance };
  } catch (err) {
    if (err instanceof Error && /already exists|Insufficient stock/i.test(err.message)) {
      throw err;
    }
    throw err;
  }
}

// Sum of opening balance + all bill grand totals - all payments (both bill & standalone).
async function getCustomerRunningBalance(customerId: number): Promise<number> {
  const customer = await db.customers.get(customerId);
  const [bills, payments] = await Promise.all([
    db.bills.where("customerId").equals(customerId).toArray(),
    db.payments.where("customerId").equals(customerId).toArray(),
  ]);
  const totalBills = bills.reduce((s, b) => s + (b.grandTotal || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  return round2((customer?.openingBalance || 0) + totalBills - totalPaid);
}

export async function getCustomerRunningBalanceById(customerId: number): Promise<number> {
  return getCustomerRunningBalance(customerId);
}

export async function deleteBill(id: number): Promise<void> {
  await db.transaction("rw", db.bills, db.billItems, db.payments, async () => {
    const bill = await db.bills.get(id);
    if (!bill) return;
    await db.billItems.where("billId").equals(id).delete();
    await db.payments.where("billId").equals(id).delete();
    await db.bills.delete(id);
  });
}

export async function countBills(): Promise<number> {
  return db.bills.count();
}

export function billTotals(bills: Bill[]) {
  return bills.reduce(
    (acc, b) => {
      acc.sales += b.grandTotal || 0;
      acc.received += b.paid || 0;
      acc.discount += b.discount || 0;
      acc.count += 1;
      acc.items += b.itemsCount || 0;
      return acc;
    },
    { sales: 0, received: 0, discount: 0, count: 0, items: 0 }
  );
}