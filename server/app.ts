import express, {Request, Response} from "express"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"
import cors from "cors"
import mongoose from "mongoose"
import authRoutes from "./routes/auth.routes"

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get("/", (req: Request, res:Response) => {
  res.send("Welcome to AM Store API!");
})


//Routes
app.use("/api/auth", authRoutes);



//mongo connection
const mongoUri = process.env.MONGO_URI;
if(!mongoUri){
  throw new Error("MONGO_URI is not defined")
}
mongoose
  .connect(mongoUri)
  .then(() => console.log(`✅ MongoDB connected to: ${process.env.MONGO_URI}`))
  .catch((err) => console.log("❌ MongoDB connection error:", err))


 
//App listening  
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${process.env.PORT}`)
})
