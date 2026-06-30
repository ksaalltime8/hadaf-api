import { Router } from "express";
import { Admin, nextId } from "../db/models.js";
import { hashPassword, verifyPassword } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";

const router = Router();

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    username: string;
    isSuperAdmin: boolean;
    permissions: string[];
  }
}

async function safeNextAdminId(): Promise<number> {
  const max = await Admin.findOne({}).sort({ id: -1 }).select("id");
  return max ? (max.get("id") as number) + 1 : 1;
}

export async function initAuth(): Promise<void> {
  try {
    const username = process.env.ADMIN_USERNAME ?? "admin";
    const password = process.env.ADMIN_PASSWORD ?? "admin123";
    const existing = await Admin.findOne({ username });
    if (!existing) {
      const id = await safeNextAdminId();
      const passwordHash = await hashPassword(password);
      await Admin.create({ id, username, passwordHash, isSuperAdmin: true });
      logger.info({ username }, "Created super admin from env");
    } else if (!existing.get("isSuperAdmin")) {
      await Admin.findOneAndUpdate({ username }, { $set: { isSuperAdmin: true } });
    }
  } catch (e) {
    logger.warn({ e }, "initAuth failed");
  }
}

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) { res.status(400).json({ ok: false, error: "بيانات ناقصة" }); return; }

  const admin = await Admin.findOne({ username });
  if (admin && await verifyPassword(password, admin.get("passwordHash"))) {
    req.session.isAdmin     = true;
    req.session.username    = username;
    req.session.isSuperAdmin= admin.get("isSuperAdmin") as boolean;
    req.session.permissions = (admin.get("permissions") as string[]) ?? [];
    req.session.save(() =>
      res.json({ ok: true, username, isSuperAdmin: req.session.isSuperAdmin, permissions: req.session.permissions })
    );
    return;
  }
  res.status(401).json({ ok: false, error: "بيانات الدخول غير صحيحة" });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/auth/me", (req, res) => {
  if (req.session.isAdmin) {
    res.json({
      authenticated: true,
      username:      req.session.username,
      isSuperAdmin:  req.session.isSuperAdmin ?? false,
      permissions:   req.session.permissions  ?? [],
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

export default router;
