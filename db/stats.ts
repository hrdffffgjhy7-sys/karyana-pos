import { db } from "./database";
import type { DashboardStats } from "@/types";

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface DayPoint {
  date: string;
  label: string;
  sales: number;
  profit: number;
  bills: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [todayBills, allBills, customersCount, products, manyBills] = await Promise.all([
    db.bills.where("date").between(startOfDay(new Date()), startOfDay(new Date(Date.now() + 86400000)), true, false).toArray(),
    db.bills.toArray(),
    db.customers.count(),
    db.products.toArray(),
    db.bills.toArray(),
  ]);

  const todaySales = round2(todayBills.reduce((s, b) => s + (b.grandTotal || 0), 0));
  const todayProfit = round2(await profitForBills(todayBills));
  const todayCount = todayBills.length;

  const totalUdhaar = round2(
    manyBills.reduce((s, b) => s + (b.remainingBalance || 0), 0)
  );

  const lowStockProducts = products.filter((p) => p.stock <= p.minStock).length;

  return {
    todaySales,
    todayBills: todayCount,
    billCount: allBills.length,
    totalCustomers: customersCount,
    totalProducts: products.length,
    totalUdhaar,
    todayProfit,
    lowStockProducts,
  };
}

// profit = sum over items of qty*(selling - purchase)
async function profitForBills(bills: { id?: number }[]): Promise<number> {
  if (!bills.length) return 0;
  const ids = bills.map((b) => b.id!).filter((id) => typeof id === "number");
  const items = await db.billItems.where("billId").anyOf(ids).toArray();
  const products = await db.products.toArray();
  const map = new Map(products.map((p) => [p.id, p.purchasePrice || 0]));
  let profit = 0;
  for (const it of items) {
    const cost = map.get(it.productId) ?? it.unitPrice ?? 0;
    profit += it.quantity * (it.unitPrice - cost);
  }
  return round2(profit);
}

export async function getSalesSeries(days: number): Promise<DayPoint[]> {
  const end = startOfDay(new Date(Date.now() + 86400000));
  const start = startOfDay(new Date(end - days * 86400000));
  const bills = await db.bills.where("date").between(start, end, true, false).toArray();
  const profit = await profitForBills(bills);

  const points: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = start + i * 86400000;
    const dayEnd = dayStart + 86400000;
    const dayBills = bills.filter((b) => b.date >= dayStart && b.date < dayEnd);
    const label = new Date(dayStart).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    points.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      label,
      sales: round2(dayBills.reduce((s, b) => s + (b.grandTotal || 0), 0)),
      profit: 0,
      bills: dayBills.length,
    });
  }

  // attach profit per day
  const items = await db.billItems.toArray();
  const products = await db.products.toArray();
  const costMap = new Map(products.map((p) => [p.id, p.purchasePrice || 0]));
  const billBucket = new Map<number, { productId?: number; qty: number; price: number }[]>();
  for (const it of items) {
    const arr = billBucket.get(it.billId) || [];
    arr.push({ productId: it.productId, qty: it.quantity, price: it.unitPrice });
    billBucket.set(it.billId, arr);
  }
  const dayProfit: Record<string, number> = {};
  for (const b of bills) {
    const dayKey = new Date(b.date).toISOString().slice(0, 10);
    const arr = billBucket.get(b.id!) || [];
    let p = 0;
    for (const it of arr) {
      const cost = costMap.get(it.productId!) ?? it.price;
      p += it.qty * (it.price - cost);
    }
    dayProfit[dayKey] = (dayProfit[dayKey] || 0) + round2(p);
  }
  points.forEach((pt) => (pt.profit = round2(dayProfit[pt.date] || 0)));

  return points;
}

export async function getLatestBills(limit = 6): Promise<import("@/types").Bill[]> {
  return db.bills.orderBy("date").reverse().limit(limit).toArray();
}

export async function getTotalUdhaar(): Promise<number> {
  const bills = await db.bills.toArray();
  return round2(bills.reduce((s, b) => s + (b.remainingBalance || 0), 0));
}