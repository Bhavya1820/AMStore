import mongoose, {Document} from "mongoose";

export type RoleName = "admin" | "sales" | "purchase";

export interface IRole extends Document {
  tenantId: mongoose.Types.ObjectId;

  name: RoleName;

  permissions: string[];

  isSystemRole: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new mongoose.Schema<IRole>(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true
    },
    name: {
       type: String,
       enum: ["admin", "sales", "purchase"],
       required: true,
       trim: true,
    },
    permissions: {
      type: [String],
      default: []
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    }
  }, 
  {
    timestamps: true,
  }
)

roleSchema.index(
  {
    tenant: 1,
    name: 1
  },
  {
    unique: true,
  }
);

const Role = mongoose.model<IRole>("Role", roleSchema);
export default Role;