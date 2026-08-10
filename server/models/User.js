import mongoose from "mongoose";
import bcrypt from "bcryptjs"

const userSchema = new mongoose.Schema({
  userName: {type: String, required: true},
  userId: {type: String, unique: true},
  email: {type: String, unique: true, lowercase: true, trim: true},
  password: {type: String, required: true},
  role: {type: String, enum:["admin", "purchase", "sales"]},
  storeId: {type: mongoose.Schema.Types.ObjectId, ref:"Store", required: true},
}, {timestamps: true});

userSchema.pre("save", async function (next) {
  if(!this.isModified("password") || !this.password){
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  if(!this.password) return false;
  return bcrypt.compare(password, this.password);
}

const User = mongoose.model("User", userSchema);
export default User;
