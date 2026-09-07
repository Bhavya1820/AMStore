import mongoose from "mongoose";
import bcrypt from "bcryptjs"

interface IUser {
  userName: string;
  userId?: string;
  email?: string;
  password: string;
  role?: "admin" | "purchase" | "sales";
  storeId: mongoose.Types.ObjectId;
}

interface IUserMethods {
  comparePassword(password: string): Promise<boolean>; 
}

type UserModel = mongoose.Model<IUser, {}, IUserMethods>;

const userSchema = new mongoose.Schema<IUser, UserModel>({
  userName: {type: String, required: true},
  userId: {type: String, unique: true},
  email: {type: String, unique: true, lowercase: true, trim: true},
  password: {type: String, required: true},
  role: {type: String, enum:["admin", "purchase", "sales"]},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref:"Store", required: true},
}, {timestamps: true});

userSchema.pre("save", async function () {
  if(!this.isModified("password") || !this.password){
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  if(!this.password) return false;
  return bcrypt.compare(password, this.password);
}

const User = mongoose.model<IUser, UserModel>("User", userSchema);
export default User;
