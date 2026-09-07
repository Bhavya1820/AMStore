export type MeasuringUnit =
  | "gram"
  | "millilitre"
  | "kilogram"
  | "litre"
  | "piece";


export type PaymentMethod =
  | "cash"
  | "upi"
  | "card"
  | "unpaid"
  | "personalupi";


export type LedgerType =
  | "sale_item"
  | "sale_invoice"
  | "purchase_item"
  | "purchase_invoice"
  | "sales_return"
  | "purchase_return"
  | "payment_in"
  | "payment_out"
  | "add_new_item"
  | "stock_adjustment"
  | "cancel_SaleInvoice"
  | "Cancel_Sale_Invoice_Item"
  | "sale_item_return"
  | "purchase_item_return";