import mongoose from "mongoose"

interface ICounter {
  storeId: mongoose.Types.ObjectId;
  name: string;
  seq: number;
}

const counterSchema = new mongoose.Schema<ICounter>({
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  name: {type: String, required: true},
  seq: {type: Number, default: 0},
}, {timestamps: true});

const Counter = mongoose.model<ICounter>("Counter", counterSchema);
export default Counter;