import mongoose, {Document} from "mongoose";

interface IStore extends Document {
  tenantId: mongoose.Types.ObjectId;

  name: string;
  email: string;
  storeCode: string;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new mongoose.Schema<IStore>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  name: {type: String, required: true, trim: true},
  email: {type: String, required: true, lowercase: true, trim: true},
  storeCode: {type: String, required: true, unique: true, uppercase: true, trim: true},
  isActive: {type: Boolean, default: true}
}, {timestamps: true});

storeSchema.index(
  {
    tenantId: 1,
    storeCode: 1,
  },
  {
    unique: true,
  }
)

const Store = mongoose.model<IStore>("Store", storeSchema);
export default Store;