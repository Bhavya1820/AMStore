import mongoose from "mongoose";

interface IRefreshToken {
  userId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  // SHA-256 of the opaque token; the raw token only lives in the httpOnly cookie
  tokenHash: string;
  // All tokens descended from one login share a family so reuse of an old token can kill the whole chain
  family: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByHash?: string;
  userAgent?: string;
  ip?: string;
}

const refreshTokenSchema = new mongoose.Schema<IRefreshToken>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  replacedByHash: { type: String },
  userAgent: { type: String },
  ip: { type: String },
}, { timestamps: true });

// Auto-remove expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model<IRefreshToken>("RefreshToken", refreshTokenSchema);
export default RefreshToken;
