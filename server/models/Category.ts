import mongoose from "mongoose";

interface ICategory {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  storeId: mongoose.Types.ObjectId;
}

const categorySchema = new mongoose.Schema<ICategory>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  name: {type: String, required: true, trim: true},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
}, {timestamps: true})

categorySchema.index({storeId: 1, name: 1}, {unique: true});

const Category = mongoose.model<ICategory>("Category", categorySchema);
export default Category;