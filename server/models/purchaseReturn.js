import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  objectId: {type: mongoose.Schema.Types.ObjectId},
  name: {type: String, required: true},
  hsn: {type: String},
  barcode: {type: String},
  quantity: {type: Number, required: true},
  measuringUnit: {type: String, enum: ["gram", "kilogram", "litre", "millilitre", "piece"]},
  purchasePrice: {type: Number},
  discount: {type: Number},
  gst: {type: Number},
  totalAmount: {type: Number}
});

const purchaseReturn = new mongoose.Schema({
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true},
  invoiceId: {type: mongoose.Schema.Types.ObjectId, ref: "Purchase"},
  purchaseReturnNumber: {type: String, required: true},
  purchaseReturnDate: {type: Date, required: true},
  items: [itemSchema],
  taxableAmount: {type: Number},
  sgst: {type: Number},
  cgst: {type: Number},
  totalAmount: {type: Number},
  amountRecieved: {type: Number},
  paymentMethod: {type: String, enum: ["cash", "upi", "card"]},
  balanceAmount:{type: Number}
}, {timestamps: true});

const PurchaseReturn = mongoose.model("PurchaseReturn", purchaseReturn);
export default PurchaseReturn;