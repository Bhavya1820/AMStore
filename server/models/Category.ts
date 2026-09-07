import mongoose from "mongoose";

interface ICategory {
  name?: string;
  items: mongoose.Types.ObjectId[];
  storeId: mongoose.Types.ObjectId;
}

const categorySchema = new mongoose.Schema<ICategory>({
  name: {type: String},
  items: [{type: mongoose.Schema.Types.ObjectId, ref: "Item"}],
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
})

const Category = mongoose.model<ICategory>("Category", categorySchema);
export default Category;