import mongoose from "mongoose";

interface IParty {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  mobileNumber?: string;
  email?: string;
  gstIn?: string;
  address?: string;
  // Running balance, kept in sync with the party ledger
  balance: number;
  isActive: boolean;
  storeId: mongoose.Types.ObjectId;
}

const partySchema = new mongoose.Schema<IParty>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  name: {type: String, required: true, trim: true},
  mobileNumber: {type: String, trim: true},
  email: {type: String, lowercase: true, trim: true},
  gstIn: {type: String, uppercase: true, trim: true},
  address: {type: String},
  balance: {type: Number, default: 0},
  isActive: {type: Boolean, default: true},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
}, {timestamps: true});

partySchema.index({storeId: 1, name: 1});

const Party = mongoose.model<IParty>("Party", partySchema);
export default Party;
