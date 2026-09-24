import { db } from "@/db/database";
import type { Payment } from "@/types";
import { startOfDay } from "@/lib/format";
import type { DayPoint } from "@/db/stats";

export interface SalesReportData {
  totalBills: number;
  totalSales: number;
  totalReceived: number;
  totalOutstanding: number;
  totalDiscount: number;
  daily: DayPoint[];
  topProducts: { name: string; quantity: number; amount: number }[];
  customerSales: { name: string; amount: number; bills: number }[];
}

export function rangeBounds(range: string, from?: string, to?: string) {
  const now = new Date();
  const todayStart = startOfDay();
  const tomorrow = todayStart + 86400000;

  if (range === "today") return { from: todayStart, to: tomorrow, label: "Today" };
  if (range === "yesterday") {
    const y = startOfDay(now.getTime() - 86400000);
    return { from: y, to: todayStart, label: "Yesterday" };
  }
  if (range === "week") {
    const dayIndex = (now.getDay() + 6) % 7;
    const monday = now.getTime() - dayIndex * 86400000;
    return { from: startOfDay(monday), to: tomorrow, label: "This Week" };
  }
  if (range === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { from: startOfDay(first.getTime()), to: startOfDay(next.getTime()), label: "This Month" };
  }
  if (range === "custom" && from && to) {
    return {
      from: startOfDay(new Date(from).getTime()),
      to: startOfDay(new Date(to).getTime()) + 86400000,
      label: `${from} to ${to}`,
    };
  }
  return { from: 0, to: tomorrow, label: "All Time" };
}

async function profitForBillItems(
  billIds: number[],
  items: { billId: number; productId?: number; quantity: number; unitPrice: number }[]
): Promise<number> {
  const products = await db.products.toArray();
  const costMap = new Map(products.map((p) => [p.id, p.purchasePrice || 0]));
  let total = 0;
  for (const it of items) {
    const cost = costMap.get(it.productId!) ?? it.unitPrice;
    total += it.quantity * (it.unitPrice - cost);
  }
  return Math.round(total * 100) / 100;
}

export async function buildSalesReport(range: string, from?: string, to?: string): Promise<SalesReportData> {
  const { from: f, to: t } = rangeBounds(range, from, to);
  const bills = await db.bills.where("date").between(f, t, true, false).toArray();
  const billIds = bills.map((b) => b.id!).filter((id) => typeof id === "number");

  const [items, payments] = await Promise.all([
    billIds.length
      ? db.billItems.where("billId").anyOf(billIds).toArray()
      : Promise.resolve([] as { billId: number; productId?: number; name: string; quantity: number; unitPrice: number; total: number }[]),
    db.payments.where("date").between(f, t, true, false).toArray(),
  ]);

  const totalSales = bills.reduce((s, b) => s + (b.grandTotal || 0), 0);
  const totalReceived = payments.reduce((s: number, p: Payment) => s + (p.amount || 0), 0);
  const totalDiscount = bills.reduce((s, b) => s + (b.discount || 0), 0);
  const totalOutstanding = bills.reduce((s, b) => s + (b.remainingBalance || 0), 0);

  // waiting for profit computed below
  const productMap = new Map<string, { name: string; quantity: number; amount: number }>();
  for (const it of items) {
    const key = it.name;
    const cur = productMap.get(key) || { name: it.name, quantity: 0, amount: 0 };
    cur.quantity += it.quantity;
    cur.amount += it.total;
    productMap.set(key, cur);
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const customerMap = new Map<string, { name: string; amount: number; bills: number }>();
  for (const b of bills) {
    const name = b.customerName || "Walk-in Customer";
    const cur = customerMap.get(name) || { name, amount: 0, bills: 0 };
    cur.amount += b.grandTotal || 0;
    cur.bills += 1;
    customerMap.set(name, cur);
  }
  const customerSales = Array.from(customerMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 10);

  const daily = await buildDays(f, t, bills, items);

  return {
    totalBills: bills.length,
    totalSales: Math.round(totalSales * 100) / 100,
    totalReceived,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalDiscount,
    daily,
    topProducts: topProducts.map((p) => ({
      ...p,
      amount: Math.round(p.amount * 100) / 100,
      quantity: Math.round(p.quantity * 100) / 100,
    })),
    customerSales,
  };
}

async function buildDays(
  from: number,
  to: number,
  bills: { id?: number; date: number; grandTotal?: number }[],
  items: { billId: number; productId?: number; quantity: number; unitPrice: number }[]
): Promise<DayPoint[]> {
  const days = Math.round((to - from) / 86400000);
  if (days <= 0 || days > 120) {
    const sales = bills.reduce((s, b) => s + (b.grandTotal || 0), 0);
    return [{ label: "Period Total", date: "", sales: Math.round(sales * 100) / 100, profit: 0, bills: bills.length }];
  }
  const products = await db.products.toArray();
  const costMap = new Map(products.map((p) => [p.id, p.purchasePrice || 0]));
  const points: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = from + i * 86400000;
    const dayEnd = dayStart + 86400000;
    const dayBills = bills.filter((b) => b.date >= dayStart && b.date < dayEnd);
    let profit = 0;
    for (const b of dayBills) {
      for (const it of items.filter((x) => x.billId === b.id)) {
        profit += it.quantity * (it.unitPrice - (costMap.get(it.productId!) ?? it.unitPrice));
      }
    }
    const d = new Date(dayStart);
    points.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sales: Math.round(dayBills.reduce((s, b) => s + (b.grandTotal || 0), 0) * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      bills: dayBills.length,
    });
  }
  return points;
}

export async function getProfit(
  bills: { id?: number }[]
): Promise<number> {
  const ids = bills.map((b) => b.id!).filter((id) => typeof id === "number");
  const items = ids.length ? await db.billItems.where("billId").anyOf(ids).toArray() : [];
  return profitForBillItems(ids, items);
}