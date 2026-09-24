import { db } from "./database";
import type { Customer, Payment } from "@/types";

export interface CustomerBalance {
  totalPurchases: number;
  totalPaid: number;
  currentBalance: number;
}

export async function listCustomers(search = ""): Promise<Customer[]> {
  const customers = await db.customers.orderBy("name").toArray();
  if (!search) return customers;
  const q = search.toLowerCase();
  return customers.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
      (c.address || "").toLowerCase().includes(q)
  );
}

export async function getCustomer(id: number): Promise<Customer | undefined> {
  return db.customers.get(id);
}

export async function addCustomer(
  data: Omit<Customer, "id" | "createdAt">
): Promise<number> {
  return db.customers.add({ ...data, createdAt: Date.now() });
}

export async function updateCustomer(
  id: number,
  data: Partial<Customer>
): Promise<void> {
  await db.customers.update(id, data);
}

export async function deleteCustomer(id: number): Promise<void> {
  const bills = await db.bills.where("customerId").equals(id).toArray();
  const billIds = bills.map((b) => b.id!).filter((x) => typeof x === "number");
  await Promise.all([
    db.billItems.where("billId").anyOf(billIds).delete(),
    db.payments.where("customerId").equals(id).delete(),
    db.bills.bulkDelete(billIds),
    db.customers.delete(id),
  ]);
}

export async function calculateCustomerBalance(customerId?: number): Promise<CustomerBalance> {
  if (!customerId) return { totalPurchases: 0, totalPaid: 0, currentBalance: 0 };
  const customer = await db.customers.get(customerId);
  const [bills, payments] = await Promise.all([
    db.bills.where("customerId").equals(customerId).toArray(),
    db.payments.where("customerId").equals(customerId).toArray(),
  ]);
  const totalPurchases = bills.reduce((s, b) => s + (b.grandTotal || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const currentBalance =
    (customer?.openingBalance || 0) + totalPurchases - totalPaid;
  return { totalPurchases, totalPaid, currentBalance };
}

export async function getCustomerTransactions(customerId: number) {
  const customer = await db.customers.get(customerId);
  const [bills, payments] = await Promise.all([
    db.bills.where("customerId").equals(customerId).reverse().sortBy("date"),
    db.payments.where("customerId").equals(customerId).reverse().sortBy("date"),
  ]);
  const items = await db.billItems
    .where("billId")
    .anyOf(bills.map((b) => b.id!).filter((id) => typeof id === "number"))
    .toArray();
  const transactions = [
    ...bills.map((b) => ({
      type: "bill" as const,
      id: b.id,
      date: b.date,
      invoiceNo: b.invoiceNo,
      amount: b.grandTotal,
      paid: b.paid,
      balanceAfter: b.remainingBalance,
      method: b.paymentMethod,
      items: items.filter((i) => i.billId === b.id),
    })),
    ...payments.map((p) => ({
      type: "payment" as const,
      id: p.id,
      date: p.date,
      invoiceNo: p.invoiceNo || "",
      amount: p.amount,
      paid: 0,
      balanceAfter: 0,
      method: p.method,
      note: p.note,
      items: [] as typeof items,
    })),
  ].sort((a, b) => b.date - a.date);

  return { customer, transactions };
}

export async function getAllCustomerBalances(): Promise<
  (Customer & { currentBalance: number; totalPurchases: number; totalPaid: number })[]
> {
  const customers = await db.customers.toArray();
  const [allBills, allPayments] = await Promise.all([
    db.bills.toArray(),
    db.payments.toArray(),
  ]);
  const byCustomer = new Map<number, { purchases: number; paid: number }>();
  for (const b of allBills) {
    if (!b.customerId) continue;
    const e = byCustomer.get(b.customerId) || { purchases: 0, paid: 0 };
    e.purchases += b.grandTotal;
    byCustomer.set(b.customerId, e);
  }
  for (const p of allPayments) {
    if (!p.customerId) continue;
    const e = byCustomer.get(p.customerId) || { purchases: 0, paid: 0 };
    e.paid += p.amount;
    byCustomer.set(p.customerId, e);
  }
  return customers
    .map((c) => {
      const e = byCustomer.get(c.id!) || { purchases: 0, paid: 0 };
      const currentBalance = (c.openingBalance || 0) + e.purchases - e.paid;
      return { ...c, currentBalance, totalPurchases: e.purchases, totalPaid: e.paid };
    })
    .sort((a, b) => b.currentBalance - a.currentBalance);
}