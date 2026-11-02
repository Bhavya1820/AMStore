export const MEASURING_UNITS = ["gram", "millilitre", "kilogram", "litre", "piece"] as const;
export type MeasuringUnit = typeof MEASURING_UNITS[number];

export const PAYMENT_METHODS = ["cash", "upi", "card", "unpaid", "personalupi"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const LEDGER_TYPES = [
  "sale_item",
  "sale_invoice",
  "purchase_item",
  "purchase_invoice",
  "sales_return",
  "purchase_return",
  "payment_in",
  "payment_out",
  "add_new_item",
  "stock_adjustment",
  "cancel_sale_invoice",
  "cancel_sale_invoice_item",
  "sale_item_return",
  "purchase_item_return",
] as const;
export type LedgerType = typeof LEDGER_TYPES[number];

// Which account a ledger entry belongs to
export const LEDGER_ACCOUNTS = ["item", "party", "user", "cash"] as const;
export type LedgerAccount = typeof LEDGER_ACCOUNTS[number];