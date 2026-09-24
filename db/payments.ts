import { db } from "./database";
import type { Payment, PaymentMethod } from "@/types";

export interface AddPaymentInput {
  customerId?: number;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  note: string;
}

export async function addPayment(input: AddPaymentInput): Promise<Payment> {
  if (!input.amount || input.amount <= 0) {
    throw new Error("Payment amount must be a positive number.");
  }
  const payment: Payment = {
    customerId: input.customerId,
    customerName: input.customerName || "Walk-in Customer",
    amount: Math.round(input.amount * 100) / 100,
    date: Date.now(),
    method: input.method,
    note: input.note,
    type: "standalone",
    createdAt: Date.now(),
  };
  const id = await db.payments.add(payment);
  return { ...payment, id };
}

export async function listRecentPayments(limit = 20): Promise<Payment[]> {
  return db.payments.orderBy("date").reverse().limit(limit).toArray();
}

export async function listPayments(options: {
  from?: number;
  to?: number;
  method?: string;
  limit?: number;
} = {}) {
  const from = options.from ?? 0;
  const to = options.to ?? Date.now() + 86400000;
  let rows = await db.payments
    .where("date")
    .between(from, to, true, false)
    .reverse()
    .sortBy("date");
  if (options.method && options.method !== "All") {
    rows = rows.filter((p) => p.method === options.method);
  }
  if (options.limit) rows = rows.slice(0, options.limit);
  return rows;
}

// The new udhaar balance after recording a standalone payment.
export async function addPaymentAndBalance(customerId: number, input: Omit<AddPaymentInput, "customerName">) {
  const customer = await db.customers.get(customerId);
  if (!customer) throw new Error("Customer not found.");
  const payment = await addPayment({ ...input, customerId, customerName: customer.name });
  const { currentBalance } = await (await import("./customers")).calculateCustomerBalance(customerId);
  return { payment, newBalance: currentBalance };
}

export async function totalReceived(from?: number, to?: number): Promise<number> {
  const rows = await listPayments({ from, to });
  return rows.reduce((s, p) => s + p.amount, 0);
}