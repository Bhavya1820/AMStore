import mongoose from "mongoose";

const partySchema = new mongoose.Schema({
  name: {type: String, required: true},
  mobileNumber: {type: String},
  email: {type: String},
  gstIn: {type: String},
  Address: {type: String},
  balance: {type: Number, default: 0}
}, {timestamps: true});

const Party = mongoose.model("Party", partySchema);
export default Party;
