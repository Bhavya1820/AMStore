import mongoose from "mongoose";
import paymentSchema from "./paymentSchema";

const ledgerSchema = new mongoose.Schema({
  date: {type: Date, default: Date.now},
  type: {
    type: String,
    enum: ["sale_item", "sale_invoice", "purchase_item", "purchase_invoice", "sales_return", "purchase_return", "payment_in", "payment_out","add_new_item", "stock_adjustment", "cancel_SaleInvoice", "Cancel_Sale_Invoice_Item", "sale_item_return", "purchase_item_return",
    ],
    required: true
  },
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party"},
  item: {type: mongoose.Schema.Types.ObjectId, ref: "Item"},
  invoiceId: {type: mongoose.Schema.Types.ObjectId},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  quantity: {type: Number},
  measuringUnit: {
    type: String,
    enum: ["gram", "millilitre", "kilogram", "litre", "piece"]
  },
  rate: {type: Number},
  amount: {type: Number},
  gstRate: {type: Number},
  gstAmount: {type: Number},
  taxRate: {type: Number},
  taxAmount: {type: Number},
  closingStock: {type: Number},
  debit: {type: Number},
  credit: {type: Number},
  partyBalance: {type: Number},
  balanceAmount: {type: Number},
  payment: [paymentSchema],
  remarks: {type: String}
}, {timeStamps: true});

const Ledger = mongoose.model("Ledger", ledgerSchema);
export default Ledger;