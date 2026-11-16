export const MEASURING_UNITS = ["gram", "millilitre", "kilogram", "litre", "piece"] as const;
export type MeasuringUnit = typeof MEASURING_UNITS[number];

export const PAYMENT_METHODS = ["cash", "upi", "card", "bank", "unpaid", "personalupi"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

// Methods that can be used when paying a vendor/party
export const PARTY_PAYMENT_METHODS = ["cash", "upi", "card", "bank"] as const;
export type PartyPaymentMethod = typeof PARTY_PAYMENT_METHODS[number];

export const LEDGER_TYPES = [
  "opening_balance",
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
