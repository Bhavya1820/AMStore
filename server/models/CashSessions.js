import mongoose from "mongoose";

const methodTotalSchema = new mongoose.Schema({
  cash: {type: Number, default: 0},
  upi: {type: Number, default: 0},
  card: {type: Number, default: 0},
  netBanking: {type: Number, default: 0},
  unpaid: {type: Number, default: 0},
  personalupi: {type: Number, default: 0}
}, {_id: false});

const cashSessionSchema = new mongoose.Schema({
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
  openingBalance: {type: Number},
  userOpeningCash: {type: Number},
  closingBalance: {type: Number},
  userClosingCash: {type: Number},
  totalSales: {type: Number, default: 0},
  paymentBreakdown: {type: methodTotalSchema, default: () => {}},
  startTime: {type: Date, default: Date.now},
  endTime: {type: Date},
  isActive: {type: Boolean, default: true}
}, {timestamps: true});

const CashSession = mongoose.model("CashSession", cashSessionSchema);
export default CashSession;