import mongoose from "mongoose"

interface ICounter {
  tenantId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  name: string;
  seq: number;
}

const counterSchema = new mongoose.Schema<ICounter>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  name: {type: String, required: true},
  seq: {type: Number, default: 0},
}, {timestamps: true});

counterSchema.index({storeId: 1, name: 1}, {unique: true});

const Counter = mongoose.model<ICounter>("Counter", counterSchema);
export default Counter;