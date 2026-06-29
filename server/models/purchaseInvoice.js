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

const paymentSchema = new mongoose.Schema({
  amount: {type: Number},
  method: {type: String, enum: ["cash", "upi", "card", "unpaid", "personalupi"]},
  date: {type: Date, default: Date.now},
})

const purchaseInvoice = new mongoose.Schema({
  party: {type: mongoose.Schema.Types.ObjectId, ref: "Party", required: true},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  invoiceNumber: {type: Number, required: true},
  invoiceDate: {type: Date, required: true},
  items: [itemSchema],
  taxableAmount: {type: Number},
  gstAmount: {type: Number},
  totalAmount: {type: Number},
  amountPaid: {type: Number},
  payments: [paymentSchema],
  balanceAmount: {type: Number}
}, {timestamps: true});

const Purchase = mongoose.model("Purchase", purchaseInvoice);
export default Purchase;

