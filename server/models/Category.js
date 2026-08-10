import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {type: String},
  items: [{type: mongoose.Schema.Types.ObjectId, ref: "Item"}],
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
})

const Category = mongoose.model("Category", categorySchema);
export default Category;