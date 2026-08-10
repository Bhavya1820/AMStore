import mongoose from "mongoose"

const counterSchema = new mongoose.Schema({
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  name: {type: String, required: true, unique: true},
  seq: {type: Number, default: 0},
}, {timestamps: true});

const Counter = mongoose.model("Counter", counterSchema);
export default Counter;