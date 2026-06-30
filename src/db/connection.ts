import mongoose from "mongoose";
import { logger } from "../lib/logger.js";

let connected = false;

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn("MONGODB_URI is not set — database operations will fail.");
    return;
  }
  if (connected) return;
  await mongoose.connect(uri);
  connected = true;
  logger.info("Connected to MongoDB");
}
