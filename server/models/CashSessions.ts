import mongoose from "mongoose";

interface IMethodTotal {
  cash: number;
  upi: number;
  card: number;
  netBanking: number;
  unpaid: number;
  personalupi: number;
}

interface ICashSession {
  userId: mongoose.Types.ObjectId;
  openingBalance?: number;
  userOpeningCash?: number;
  closingBalance?: number;
  userClosingCash?: number;
  totalSales: number;
  paymentBreakdown: IMethodTotal;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  storeId: mongoose.Types.ObjectId;
}

const methodTotalSchema = new mongoose.Schema<IMethodTotal>({
  cash: {type: Number, default: 0},
  upi: {type: Number, default: 0},
  card: {type: Number, default: 0},
  netBanking: {type: Number, default: 0},
  unpaid: {type: Number, default: 0},
  personalupi: {type: Number, default: 0}
}, {_id: false});

const cashSessionSchema = new mongoose.Schema<ICashSession>({
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
  openingBalance: {type: Number},
  userOpeningCash: {type: Number},
  closingBalance: {type: Number},
  userClosingCash: {type: Number},
  totalSales: {type: Number, default: 0},
  paymentBreakdown: {type: methodTotalSchema, default: () => {}},
  startTime: {type: Date, default: Date.now},
  endTime: {type: Date},
  isActive: {type: Boolean, default: true},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
}, {timestamps: true});

const CashSession = mongoose.model<ICashSession>("CashSession", cashSessionSchema);
export default CashSession;