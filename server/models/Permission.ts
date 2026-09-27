import mongoose, {Document} from "mongoose";

export interface IPermission extends Document{
  key: string;
  module: string;
  action: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new mongoose.Schema<IPermission>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    module: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
  }, 
  {
    timestamps: true
  }
)

permissionSchema.index(
  {
    module: 1, 
    action: 1,
  },
  {
    unique: true
  }
);

const Permission = mongoose.model<IPermission>("Permission", permissionSchema);
export default Permission