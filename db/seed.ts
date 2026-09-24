import { db } from "./database";
import type { Product, Customer } from "@/types";

// Prices are stored per gram, stock is stored in grams (base unit = GRAM).
export const DEMO_PRODUCTS: Omit<Product, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Sugar (Sugar Mills)", sku: "SUG-001", barcode: "89640001", category: "Groceries", purchasePrice: 0.135, sellingPrice: 0.14, stock: 80000, minStock: 20000, unit: "Gram" },
  { name: "Wheat Flour (Chakki)", sku: "FLO-002", barcode: "89640002", category: "Groceries", purchasePrice: 0.09, sellingPrice: 0.1, stock: 60000, minStock: 20000, unit: "Gram" },
  { name: "Basmati Rice (Super)", sku: "RIC-003", barcode: "89640003", category: "Grains", purchasePrice: 0.22, sellingPrice: 0.26, stock: 40000, minStock: 10000, unit: "Gram" },
  { name: "Tea (Tapal Danedar 190g)", sku: "TEA-004", barcode: "89640004", category: "Beverages", purchasePrice: 0.48, sellingPrice: 0.51, stock: 25000, minStock: 10000, unit: "Gram" },
  { name: "Milk (Olper's 1L)", sku: "MLK-005", barcode: "89640005", category: "Dairy", purchasePrice: 0.21, sellingPrice: 0.225, stock: 30000, minStock: 10000, unit: "Gram" },
  { name: "Cooking Oil (Dalda 1L)", sku: "OIL-006", barcode: "89640006", category: "Oil & Ghee", purchasePrice: 0.45, sellingPrice: 0.48, stock: 20000, minStock: 8000, unit: "Gram" },
  { name: "Ghee (Dalda 1Kg)", sku: "GHE-007", barcode: "89640007", category: "Oil & Ghee", purchasePrice: 0.62, sellingPrice: 0.66, stock: 15000, minStock: 6000, unit: "Gram" },
  { name: "Tea Biscuits (Sooper)", sku: "BIS-008", barcode: "89640008", category: "Snacks", purchasePrice: 0.06, sellingPrice: 0.08, stock: 50000, minStock: 15000, unit: "Gram" },
  { name: "Cold Drink (Coke 1.5L)", sku: "CLD-009", barcode: "89640009", category: "Beverages", purchasePrice: 0.14, sellingPrice: 0.16, stock: 36000, minStock: 12000, unit: "Gram" },
  { name: "Soap (Lux 160g)", sku: "SOA-010", barcode: "89640010", category: "Personal Care", purchasePrice: 0.095, sellingPrice: 0.11, stock: 40000, minStock: 12000, unit: "Gram" },
  { name: "Shampoo (Lifebuoy 340ml)", sku: "SHA-011", barcode: "89640011", category: "Personal Care", purchasePrice: 0.24, sellingPrice: 0.27, stock: 18000, minStock: 8000, unit: "Gram" },
  { name: "Chilli Powder (Lahori 250g)", sku: "CHL-012", barcode: "89640012", category: "Spices", purchasePrice: 0.18, sellingPrice: 0.21, stock: 22000, minStock: 8000, unit: "Gram" },
  { name: "Salt (Pink Salt 1Kg)", sku: "SLT-013", barcode: "89640013", category: "Groceries", purchasePrice: 0.07, sellingPrice: 0.09, stock: 35000, minStock: 10000, unit: "Gram" },
  { name: "Onion", sku: "VEG-014", barcode: "89640014", category: "Vegetables", purchasePrice: 0.08, sellingPrice: 0.1, stock: 12000, minStock: 5000, unit: "Gram" },
  { name: "Potato", sku: "VEG-015", barcode: "89640015", category: "Vegetables", purchasePrice: 0.06, sellingPrice: 0.08, stock: 4000, minStock: 8000, unit: "Gram" },
  { name: "Dates (Chhuhara)", sku: "MISC-016", barcode: "89640016", category: "Misc", purchasePrice: 0.2, sellingPrice: 0.23, stock: 10000, minStock: 3000, unit: "Gram" },
  { name: "Eggs (Dozen)", sku: "EGG-017", barcode: "89640017", category: "Dairy", purchasePrice: 0.21, sellingPrice: 0.24, stock: 20000, minStock: 6000, unit: "Gram" },
  { name: "Noodles (Knorr 55g)", sku: "NDL-018", barcode: "89640018", category: "Snacks", purchasePrice: 0.05, sellingPrice: 0.07, stock: 45000, minStock: 12000, unit: "Gram" },
  { name: "Cooking Salt (Fine 800g)", sku: "SLT-019", barcode: "89640019", category: "Groceries", purchasePrice: 0.045, sellingPrice: 0.06, stock: 0, minStock: 10000, unit: "Gram" },
  { name: "Washing Powder (Surf Excel 1Kg)", sku: "WAS-020", barcode: "89640020", category: "Household", purchasePrice: 0.32, sellingPrice: 0.35, stock: 26000, minStock: 8000, unit: "Gram" },
];

export const DEMO_CUSTOMERS: Omit<Customer, "id" | "createdAt">[] = [
  { name: "Ahmed Khan", phone: "03001234567", address: "House 12, Street 4, Main Bazaar", openingBalance: 1500, notes: "Regular customer" },
  { name: "Ali Raza", phone: "03017654321", address: "Shop 8, Vegetable Market", openingBalance: 0, notes: "" },
  { name: "Usman Tariq", phone: "03459876543", address: "Street 9, Model Colony", openingBalance: 800, notes: "" },
  { name: "Bilal Hussain", phone: "03211234567", address: "Flat 3, Green Apartments", openingBalance: 0, notes: "Pays on weekends" },
];

export async function loadDemoData(): Promise<{ products: number; customers: number }> {
  const productCount = await db.products.count();
  const customerCount = await db.customers.count();
  if (productCount > 0 || customerCount > 0) {
    throw new Error("Existing data found. Demo data was NOT loaded to avoid overwriting your data.");
  }
  const now = Date.now();
  const pIds: number[] = [];
  for (const p of DEMO_PRODUCTS) {
    const id = await db.products.add({ ...p, createdAt: now, updatedAt: now });
    pIds.push(id);
    await db.stockMovements.add({
      productId: id,
      productName: p.name,
      type: "demo",
      quantity: p.stock,
      note: "Demo data",
      date: now,
    });
  }
  for (const c of DEMO_CUSTOMERS) {
    await db.customers.add({ ...c, createdAt: now });
  }
  return { products: pIds.length, customers: DEMO_CUSTOMERS.length };
}