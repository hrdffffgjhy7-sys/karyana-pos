import { db } from "./database";
import { getSettings } from "./settings";
import type { Product, Unit } from "@/types";

export interface ProductFilter {
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
  outOfStockOnly?: boolean;
}

export async function listProducts(filter: ProductFilter = {}): Promise<Product[]> {
  let collection = db.products.orderBy("name");

  let products = await collection.toArray();

  if (filter.category && filter.category !== "All") {
    products = products.filter((p) => p.category === filter.category);
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }
  if (filter.lowStockOnly) {
    products = products.filter((p) => p.stock <= p.minStock);
  }
  if (filter.outOfStockOnly) {
    products = products.filter((p) => p.stock <= 0);
  }
  return products;
}

export async function getProduct(id: number): Promise<Product | undefined> {
  return db.products.get(id);
}

export async function getProductCategories(): Promise<string[]> {
  const products = await db.products.toArray();
  return Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();
}

export async function addProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt">
): Promise<number> {
  const now = Date.now();
  const id = await db.products.add({ ...data, createdAt: now, updatedAt: now });
  await db.stockMovements.add({
    productId: id,
    productName: data.name,
    type: "init",
    quantity: data.stock,
    note: "Initial stock",
    date: now,
  });
  return id;
}

export async function updateProduct(
  id: number,
  data: Partial<Product>
): Promise<void> {
  await db.products.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteProduct(id: number): Promise<void> {
  await db.products.delete(id);
}

export async function adjustStock(
  id: number,
  delta: number,
  note: string
): Promise<Product> {
  const product = await db.products.get(id);
  if (!product) throw new Error("Product not found");
  const newStock = Math.round((product.stock + delta) * 1000) / 1000;
  const s = await getSettings();
  if (!s.allowNegativeStock && newStock < 0) {
    throw new Error(`Insufficient stock. Only ${product.stock} ${product.unit} available.`);
  }
  await db.products.update(id, { stock: newStock, updatedAt: Date.now() });
  await db.stockMovements.add({
    productId: id,
    productName: product.name,
    type: delta < 0 ? "adjustment" : "restock",
    quantity: delta,
    note: note || (delta < 0 ? "Stock adjustment (-)" : "Stock added"),
    date: Date.now(),
  });
  return { ...product, stock: newStock };
}

export async function getLowStockProducts(): Promise<Product[]> {
  const products = await db.products.toArray();
  return products.filter((p) => p.stock <= p.minStock);
}

export async function countProducts(): Promise<number> {
  return db.products.count();
}
export const UNITS: Unit[] = ["Piece", "Kg", "Gram", "Liter", "Pack", "Dozen"];

export const WEIGHT_UNITS: Unit[] = ["Gram", "Kg"];
export const GRAMS_PER_KG = 1000;

export function isWeightUnit(unit: Unit): boolean {
  return WEIGHT_UNITS.includes(unit);
}

export function perGramPrice(kgPrice: number): number {
  return Math.round((kgPrice / GRAMS_PER_KG) * 1000) / 1000;
}

export function perKgPrice(perGram: number): number {
  return Math.round(perGram * GRAMS_PER_KG * 100) / 100;
}

export const GRAM_PRESETS: { label: string; grams: number }[] = [
  { label: "Aadha Pao", grams: 125 },
  { label: "1 Pao", grams: 250 },
  { label: "Aadha Kilo", grams: 500 },
  { label: "1 Kilo", grams: 1000 },
];