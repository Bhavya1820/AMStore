import mongoose from "mongoose";
import { paymentSchema, IPayment } from "./paymentSchema";
import { MeasuringUnit, LedgerType, LedgerAccount, LEDGER_TYPES, LEDGER_ACCOUNTS, MEASURING_UNITS } from "./Common";

/**
 * Append-only ledger. Entries are never edited or deleted: corrections are
 * written as new entries with `reversalOf` pointing at the original.
 *
 * `account` + `accountId` identify whose ledger the row belongs to:
 *   item  -> Item._id   (stock movement; use quantity/closingStock)
 *   party -> Party._id  (vendor/party; use debit/credit/balanceAmount)
 *   user  -> User._id   (staff activity / cash handled)
 *   cash  -> CashSession._id
 */
interface ILedger {
  tenantId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  account: LedgerAccount;
  accountId: mongoose.Types.ObjectId;
  date: Date;
  type: LedgerType;
  party?: mongoose.Types.ObjectId;
  item?: mongoose.Types.ObjectId;
  invoiceId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  reversalOf?: mongoose.Types.ObjectId;
  quantity?: number;
  measuringUnit?: MeasuringUnit;
  rate?: number;
  amount?: number;
  gstRate?: number;
  gstAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  closingStock?: number;
  debit: number;
  credit: number;
  partyBalance?: number;
  balanceAmount?: number;
  payment: IPayment[];
  remarks?: string;
}

const ledgerSchema = new mongoose.Schema<ILedger>({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  account: { type: String, enum: LEDGER_ACCOUNTS, required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, required: true },
  date: { type: Date, default: Date.now },
  type: { type: String, enum: LEDGER_TYPES, required: true },
  party: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
  invoiceId: { type: mongoose.Schema.Types.ObjectId },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "Ledger" },
  quantity: { type: Number },
  measuringUnit: { type: String, enum: MEASURING_UNITS },
  rate: { type: Number },
  amount: { type: Number },
  gstRate: { type: Number },
  gstAmount: { type: Number },
  taxRate: { type: Number },
  taxAmount: { type: Number },
  closingStock: { type: Number },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  partyBalance: { type: Number },
  balanceAmount: { type: Number },
  payment: [paymentSchema],
  remarks: { type: String }
}, {timestamps: true});

// Statement queries: one account's history in date order
ledgerSchema.index({ storeId: 1, account: 1, accountId: 1, date: 1 });
ledgerSchema.index({ storeId: 1, invoiceId: 1 });
ledgerSchema.index({ storeId: 1, userId: 1, date: -1 });

// Enforce append-only at the schema level
const blockMutation = function () {
  throw new Error("Ledger entries are append-only; write a reversal entry instead");
};
ledgerSchema.pre("updateOne", blockMutation);
ledgerSchema.pre("updateMany", blockMutation);
ledgerSchema.pre("findOneAndUpdate", blockMutation);
ledgerSchema.pre("deleteOne", blockMutation);
ledgerSchema.pre("deleteMany", blockMutation);
ledgerSchema.pre("findOneAndDelete", blockMutation);

const Ledger = mongoose.model<ILedger>("Ledger", ledgerSchema);
export default Ledger;