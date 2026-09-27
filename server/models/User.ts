import mongoose from "mongoose";
import bcrypt from "bcryptjs"

export interface IUser {
  tenantId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId;

  userName: string;
  userId?: string;
  email?: string;
  password: string;

  isActive: boolean;
}

interface IUserMethods {
  comparePassword(password: string): Promise<boolean>;
}

type UserModel = mongoose.Model<IUser, {}, IUserMethods>;

const userSchema = new mongoose.Schema<IUser, UserModel>({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
    index: true,
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true,
  },
  userName: {
    type: String,
    required: true,
    trim: true,
  },
  userId: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

userSchema.index(
  { tenantId: 1, storeId: 1, userName: 1 },
  { unique: true }
);

userSchema.index(
  {tenantId: 1, email: 1},
  {unique: true, sparse: true},
)

userSchema.index(
  {tenantId: 1, storeId: 1, userId: 1},
  {unique: true, sparse: true},
)

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
}

const User = mongoose.model<IUser, UserModel>("User", userSchema);
export default User;
