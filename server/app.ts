import dotenv from "dotenv"
dotenv.config();

import express, {Request, Response} from "express"
import cookieParser from "cookie-parser"
import cors from "cors"
import mongoose from "mongoose"

import authRoutes from "./routes/auth.routes"
import userRoutes from "./routes/user.routes"
import storeRoutes from "./routes/store.routes"
import inventoryRoutes from "./routes/inventory.routes"
import { errorHandler, notFoundHandler } from "./middleware/errorHandler"
import { seedPermissions } from "./services/permission.service"

const app = express();

// Cookies (refresh token) require an explicit origin list: CLIENT_ORIGIN=http://localhost:5173,https://app.example.com
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins?.length ? allowedOrigins : process.env.NODE_ENV !== "production",
  credentials: true,
}));
app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());

app.get("/", (req: Request, res:Response) => {
  res.send("Welcome to AM Store API!");
})


//Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/inventory", inventoryRoutes);

app.use(notFoundHandler);
app.use(errorHandler);


//mongo connection
const mongoUri = process.env.MONGO_URI;
if(!mongoUri){
  throw new Error("MONGO_URI is not defined")
}

async function start() {
  await mongoose.connect(mongoUri as string);
  console.log("MongoDB connected");

  await seedPermissions();

  //App listening
  app.listen(process.env.PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT}`)
  })
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
