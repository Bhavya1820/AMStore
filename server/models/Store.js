import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
  name: {type: String, required: true},
  email: {type: String, required: true},
  storeCode: {type: String, required: true, unique: true},
  isActive: {type: Boolean, default: true}
}, {timestamps: true});

const Store = mongoose.model("Store", storeSchema);
export default Store;