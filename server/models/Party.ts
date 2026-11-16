import mongoose from "mongoose";

/**
 * A vendor the store buys inventory from.
 *
 * `balance` is what the store owes the party (payable):
 *   > 0  store owes the party
 *   < 0  store has paid in advance
 * It is only ever changed with atomic $inc alongside an append-only party ledger entry.
 */
interface IParty {
  tenantId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  name: string;
  mobileNumber?: string;
  email?: string;
  gstIn?: string;
  address?: string;
  openingBalance: number;
  balance: number;
  // false = archived (kept because it has ledger history)
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const partySchema = new mongoose.Schema<IParty>({
  tenantId: {type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true},
  name: {type: String, required: true, trim: true},
  mobileNumber: {type: String, trim: true},
  email: {type: String, lowercase: true, trim: true},
  gstIn: {type: String, uppercase: true, trim: true},
  address: {type: String, trim: true},
  openingBalance: {type: Number, default: 0},
  balance: {type: Number, default: 0},
  isActive: {type: Boolean, default: true},
  createdBy: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
}, {timestamps: true});

partySchema.index({storeId: 1, name: 1});
partySchema.index({storeId: 1, isActive: 1, balance: -1});

const Party = mongoose.model<IParty>("Party", partySchema);
export default Party;
