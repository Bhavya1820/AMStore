import mongoose from "mongoose"

const itemSchema = new mongoose.Schema({
  objectId: {type: mongoose.Schema.Types.ObjectId},
  name: {type: String, required: true},
  hsn: {type: String},
  barcode: {type: String},
  quantity: {type: Number, required: true},
  measuringUnit: {type: String, enum: ["gram", "kilogram", "litre", "millilitre", "piece"]},
  salePrice: {type: Number},
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

const saleInvoice = new mongoose.Schema({
  customerName: {type: String},
  customerPhoneNumber: {type: String},
  invoiceNumber: {type: String, required: true},
  invoiceDate: {type: Date, required: true},
  userId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
  items: [itemSchema],
  taxableAmount: {type: Number},
  sgst: {type: Number},
  cgst: {type: Number},
  totalAmount: {type: Number},
  amountReceived: {type: Number},
  payments: [paymentSchema],
  cancelled: {type: Boolean, default: false}
}, {timestamps: true});

const Sale = mongoose.model("Sale", saleInvoice);
export default Sale;