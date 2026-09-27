export type Unit =
  | "Gram"
  | "Kg"
  | "Piece"
  | "Bottle"
  | "Packet"
  | "Pack"
  | "Box"
  | "Tube"
  | "Sachet"
  | "Dozen"
  | "ML"
  | "Liter"
  | "Half Liter";

export type PaymentMethod =
  | "Cash"
  | "Easypaisa"
  | "JazzCash"
  | "Bank"
  | "Other";

export type ReceiptSize = "58mm" | "80mm" | "A4";

export type BillStatus = "Paid" | "Udhaar" | "Partial";

export interface Product {
  id?: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  unit: Unit;
  createdAt: number;
  updatedAt: number;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  address: string;
  openingBalance: number;
  notes: string;
  createdAt: number;
}

export interface Bill {
  id?: number;
  invoiceNo: string;
  customerId?: number;
  customerName: string;
  customerPhone: string;
  date: number;
  itemsCount: number;
  subtotal: number;
  discount: number;
  previousBalance: number;
  grandTotal: number;
  paid: number;
  remainingBalance: number;
  paymentMethod: PaymentMethod;
  status: BillStatus;
  createdAt: number;
}

export interface BillItem {
  id?: number;
  billId: number;
  productId?: number;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit: string;
}

export interface Payment {
  id?: number;
  customerId?: number;
  customerName: string;
  billId?: number;
  invoiceNo?: string;
  amount: number;
  date: number;
  method: PaymentMethod;
  note: string;
  type: "bill" | "standalone";
  createdAt: number;
}

export type StockMovementType = "sale" | "adjustment" | "restock" | "demo" | "init";

export interface StockMovement {
  id?: number;
  productId: number;
  productName: string;
  type: StockMovementType;
  quantity: number; // signed: negative = stock out, positive = stock in
  note: string;
  date: number;
}

export interface AppSettings {
  id?: number;
  key: string; // 'default'
  storeName: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  address: string;
  currency: string;
  currencySymbol: string;
  invoicePrefix: string;
  startingInvoiceNumber: string;
  receiptSize: ReceiptSize;
  allowNegativeStock: boolean;
  logo: string | null;
  billWhatsappTemplate: string;
  udhaarWhatsappTemplate: string;
}

export interface CartItemInput {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  stock: number;
}

export interface CreateBillInput {
  customerId?: number;
  customerName: string;
  customerPhone: string;
  items: CartItemInput[];
  discount: number;
  paid: number;
  paymentMethod: PaymentMethod;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  products: Product[];
  customers: Customer[];
  bills: Bill[];
  billItems: BillItem[];
  payments: Payment[];
  settings: AppSettings[];
  stockMovements: StockMovement[];
}

export interface DashboardStats {
  todaySales: number;
  todayBills: number;
  billCount: number;
  totalCustomers: number;
  totalProducts: number;
  totalUdhaar: number;
  todayProfit: number;
  lowStockProducts: number;
}