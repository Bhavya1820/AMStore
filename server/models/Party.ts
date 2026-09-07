import mongoose from "mongoose";

interface IParty {
  name: string;
  mobileNumber?: string;
  email?: string;
  gstIn?: string;
  Address?: string;
  balance?: number;
  storeId: mongoose.Types.ObjectId;
}

const partySchema = new mongoose.Schema<IParty>({
  name: {type: String, required: true},
  mobileNumber: {type: String},
  email: {type: String},
  gstIn: {type: String},
  Address: {type: String},
  balance: {type: Number, default: 0},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
}, {timestamps: true});

const Party = mongoose.model<IParty>("Party", partySchema);
export default Party;
