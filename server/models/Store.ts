import mongoose, {Document} from "mongoose";

interface IStore extends Document {
  name: string;
  email: string;
  storeCode: string;
  isActive: boolean;
}

const storeSchema = new mongoose.Schema<IStore>({
  name: {type: String, required: true, trim: true},
  email: {type: String, required: true, lowercase: true, index: true, trim: true},
  storeCode: {type: String, required: true, unique: true, uppercase: true, index: true, trim: true},
  isActive: {type: Boolean, default: true}
}, {timestamps: true});

const Store = mongoose.model<IStore>("Store", storeSchema);
export default Store;