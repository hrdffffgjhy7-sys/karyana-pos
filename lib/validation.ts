export interface FieldError {
  field: string;
  message: string;
}

export function validateProductName(name: string): string | null {
  if (!name || !name.trim()) return "Product name is required.";
  if (name.trim().length < 2) return "Product name is too short.";
  return null;
}

export function validatePrice(value: number, label = "Price"): string | null {
  if (isNaN(value) || value < 0) return `${label} must be zero or a positive number.`;
  return null;
}

export function validateSellingPrice(selling: number, purchase: number): string | null {
  if (isNaN(selling) || selling < 0) return "Selling price must be a positive number.";
  if (purchase > 0 && selling < purchase) return "Selling price is below purchase price.";
  return null;
}

export function validateStock(value: number): string | null {
  if (isNaN(value) || value < 0) return "Stock cannot be negative.";
  return null;
}

export function validateProduct(input: {
  name: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
}): FieldError | null {
  const nameErr = validateProductName(input.name);
  if (nameErr) return { field: "name", message: nameErr };
  const sellErr = validateSellingPrice(input.sellingPrice, input.purchasePrice);
  if (sellErr) return { field: "sellingPrice", message: sellErr };
  const buyErr = validatePrice(input.purchasePrice, "Purchase price");
  if (buyErr) return { field: "purchasePrice", message: buyErr };
  const stockErr = validateStock(input.stock);
  if (stockErr) return { field: "stock", message: stockErr };
  return null;
}

export function validateCustomerName(name: string): string | null {
  if (!name || !name.trim()) return "Customer name is required.";
  return null;
}

export function validatePhone(phone: string): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits && (digits.length < 6 || digits.length > 15)) {
    return "Please enter a valid phone number (6-15 digits).";
  }
  return null;
}

export function validateCustomer(input: {
  name: string;
  phone: string;
  openingBalance: number;
}): FieldError | null {
  const nameErr = validateCustomerName(input.name);
  if (nameErr) return { field: "name", message: nameErr };
  const phoneErr = validatePhone(input.phone);
  if (phoneErr) return { field: "phone", message: phoneErr };
  if (isNaN(input.openingBalance) || input.openingBalance < 0) {
    return { field: "openingBalance", message: "Opening balance cannot be negative." };
  }
  return null;
}

export function validateBillInput(input: {
  itemsCount: number;
  subtotal: number;
  discount: number;
  paid: number;
  previousBalance: number;
}): FieldError | null {
  if (input.itemsCount <= 0) {
    return { field: "items", message: "Add at least one product to create the bill." };
  }
  if (isNaN(input.discount) || input.discount < 0) {
    return { field: "discount", message: "Discount cannot be negative." };
  }
  if (input.discount > input.subtotal) {
    return { field: "discount", message: "Discount cannot be greater than the subtotal." };
  }
  const grandTotal = input.subtotal - input.discount;
  if (grandTotal < 0) {
    return { field: "discount", message: "Discount cannot make the total negative." };
  }
  if (isNaN(input.paid) || input.paid < 0) {
    return { field: "paid", message: "Paid amount cannot be negative." };
  }
  if (input.paid > grandTotal + input.previousBalance + 0.01) {
    return { field: "paid", message: `Paid amount cannot exceed Rs. ${(grandTotal + input.previousBalance).toLocaleString()}.` };
  }
  return null;
}

export function validateQuantity(value: number): string | null {
  if (isNaN(value) || value <= 0) return "Quantity must be greater than zero.";
  return null;
}

export function validatePayment(amount: number): string | null {
  if (isNaN(amount) || amount <= 0) return "Payment amount must be a positive number.";
  return null;
}