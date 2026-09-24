import Dexie, { type Table } from "dexie";
import type {
  Product,
  Customer,
  Bill,
  BillItem,
  Payment,
  AppSettings,
  StockMovement,
} from "@/types";

export class KaryanaDB extends Dexie {
  products!: Table<Product, number>;
  customers!: Table<Customer, number>;
  bills!: Table<Bill, number>;
  billItems!: Table<BillItem, number>;
  payments!: Table<Payment, number>;
  settings!: Table<AppSettings, number>;
  stockMovements!: Table<StockMovement, number>;

  constructor() {
    super("imran-arain-karyana");
    const schema = {
      products: "++id, name, sku, barcode, category, sellingPrice, stock, updatedAt",
      customers: "++id, name, phone, createdAt",
      bills: "++id, invoiceNo, customerId, customerName, date, createdAt, status",
      billItems: "++id, billId, productId, name",
      payments: "++id, customerId, customerName, billId, date, method, createdAt",
      settings: "++id, key",
      stockMovements: "++id, productId, date, type",
    };
    this.version(1).stores(schema);
    // v2: base unit = GRAM. Stock/minStock stored in grams, prices stored per gram.
    this.version(2)
      .stores(schema)
      .upgrade(async (tx) => {
        await tx
          .table("products")
          .toCollection()
          .modify((p) => {
            p.stock = Math.round((p.stock || 0) * 1000);
            p.minStock = Math.round((p.minStock || 0) * 1000);
            p.purchasePrice = (p.purchasePrice || 0) / 1000;
            p.sellingPrice = (p.sellingPrice || 0) / 1000;
            p.unit = "Gram";
          });
      });
  }
}

export const db = new KaryanaDB();

export const paymentMethods: Payment["method"][] = [
  "Cash",
  "Easypaisa",
  "JazzCash",
  "Bank",
  "Other",
];