import mongoose from "mongoose"

const itemSchema = new mongoose.Schema({
  name: {type: String, required: true},
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },
  salePrice: {type: Number, required: true},
  salePriceWithTax: {type: Boolean, default: false},
  purchasePrice: {type: Number, required: true},
  purchasePriceWithTax: {type: Boolean, default: false},
  gst: {type: Number, required: true},
  measuringUnit: {
    type: String,
    enum: ["gram", "millilitre", "kilogram", "litre", "piece"],
    required: true
  },
  currentStock: {type: Number, default: 0},
  lowStock: {type: Number, default: 0},
  barcode: {type: String, required: true},
  hsn: {type: String, required: true},
}, {timestamps: true});

const Item = mongoose.model("Item", itemSchema);
export default Item;