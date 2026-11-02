import mongoose, {Document} from "mongoose";

export const ROLE_NAMES = ["owner", "admin", "sales", "purchase"] as const;
export type RoleName = typeof ROLE_NAMES[number];

export interface IRole extends Document {
  tenantId: mongoose.Types.ObjectId;

  name: RoleName;

  permissions: mongoose.Types.ObjectId[];

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
       enum: ROLE_NAMES,
       required: true,
       trim: true,
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      }
    ],
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
    tenantId: 1,
    name: 1
  },
  {
    unique: true,
  }
);

const Role = mongoose.model<IRole>("Role", roleSchema);
export default Role;