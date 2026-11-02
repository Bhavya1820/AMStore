import mongoose from "mongoose";
import bcrypt from "bcryptjs"

export interface IUser {
  tenantId: mongoose.Types.ObjectId;
  // Stores this user can access. Empty array = all stores in the tenant (owner only).
  // Sales and purchase staff have exactly one entry; facility admins have one or more.
  storeIds: mongoose.Types.ObjectId[];
  roleId: mongoose.Types.ObjectId;

  // True only for the tenant owner (the person who registered). Cannot be edited/deactivated by others.
  isOwner: boolean;

  userName: string;
  userId?: string;
  email?: string;
  password: string;

  // Set when an admin creates the account or resets the password; user must choose a new one on next login
  mustChangePassword: boolean;

  // Per-user feature access on top of the role's defaults (permission keys, e.g. "sale:create")
  grantedPermissions: string[];
  revokedPermissions: string[];

  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;

  // Brute-force protection
  failedLoginCount: number;
  lockUntil?: Date;
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
  storeIds: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Store" }],
    default: [],
    index: true,
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true,
  },
  isOwner: {
    type: Boolean,
    default: false,
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
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  mustChangePassword: { type: Boolean, default: false },
  grantedPermissions: { type: [String], default: [] },
  revokedPermissions: { type: [String], default: [] },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  lastLoginAt: { type: Date },
  passwordChangedAt: { type: Date },
  failedLoginCount: { type: Number, default: 0 },
  lockUntil: { type: Date },
}, { timestamps: true });

// userName is unique within a tenant (staff log in with storeCode + userName)
userSchema.index(
  { tenantId: 1, userName: 1 },
  { unique: true }
);

// Email is globally unique because login by email must resolve to exactly one tenant.
// Partial index: sparse does not skip null/missing consistently, so only index real strings
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);

userSchema.index(
  { tenantId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "string" } } },
);

// Only one owner per tenant
userSchema.index(
  { tenantId: 1, isOwner: 1 },
  { unique: true, partialFilterExpression: { isOwner: true } },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
}

const User = mongoose.model<IUser, UserModel>("User", userSchema);
export default User;
