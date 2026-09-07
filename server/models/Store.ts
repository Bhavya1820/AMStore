import mongoose from "mongoose";

interface IStore {
  name: string;
  email: string;
  storeCode: string;
  isActive: boolean;
}

const storeSchema = new mongoose.Schema<IStore>({
  name: {type: String, required: true},
  email: {type: String, required: true},
  storeCode: {type: String, required: true, unique: true},
  isActive: {type: Boolean, default: true}
}, {timestamps: true});

const Store = mongoose.model<IStore>("Store", storeSchema);
export default Store;