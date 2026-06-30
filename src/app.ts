import express from "express";
import cors from "cors";
import session from "express-session";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { connectDB } from "./db/connection.js";
import { initAuth } from "./routes/auth.js";

const app = express();

connectDB()
  .then(() => initAuth())
  .catch(err => logger.error({ err }, "MongoDB connection error"));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "hdf-united-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api", router);

export default app;
