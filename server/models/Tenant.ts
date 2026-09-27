import mongoose, {Document} from "mongoose";

export type TenantStatus = "trial" | "active" | "suspended" | "cancelled";

export interface ITenant extends Document {
  name: string;
  ownerEmail: string;

  status: TenantStatus;
  
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new mongoose.Schema<ITenant>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  ownerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: ["trial", "active", "suspended", "cancelled"],
    default: "trial",
    index: true
  },

}, {
  timestamps: true
});

const Tenant = mongoose.model<ITenant>("Tenant", tenantSchema);
export default Tenant;

