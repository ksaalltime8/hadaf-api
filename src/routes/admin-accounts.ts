import { Router } from "express";
import { z } from "zod";
import { Admin, nextId } from "../db/models.js";
import { hashPassword } from "../lib/crypto.js";

const router = Router();

const PAGE_KEYS = ["dashboard", "subscriptions", "hr", "finance", "registrations", "accounts"] as const;

const CreateAdmin = z.object({
  username:    z.string().min(2).max(30),
  password:    z.string().min(6),
  displayName: z.string().optional(),
  permissions: z.array(z.enum(PAGE_KEYS)).optional(),
});

const UpdateAdmin = z.object({
  password:    z.string().min(6).optional(),
  displayName: z.string().optional(),
  permissions: z.array(z.enum(PAGE_KEYS)).optional(),
});

function guard(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]): boolean {
  if (!req.session?.isAdmin) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

router.get("/admin-accounts", async (req, res) => {
  if (!guard(req, res)) return;
  const admins = await Admin.find().sort({ createdAt: 1 });
  res.json(admins.map(a => {
    const j = a.toJSON() as Record<string, unknown>;
    delete j.passwordHash;
    return j;
  }));
});

router.post("/admin-accounts", async (req, res) => {
  if (!guard(req, res)) return;
  const parsed = CreateAdmin.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { username, password, displayName, permissions } = parsed.data;
  const exists = await Admin.findOne({ username });
  if (exists) { res.status(409).json({ error: "اسم المستخدم موجود مسبقاً" }); return; }
  const id = await nextId("admins");
  const admin = await Admin.create({ id, username, passwordHash: await hashPassword(password), displayName: displayName ?? null, isSuperAdmin: false, permissions: permissions ?? [] });
  const j = admin.toJSON() as Record<string, unknown>;
  delete j.passwordHash;
  res.status(201).json(j);
});

router.patch("/admin-accounts/:id", async (req, res) => {
  if (!guard(req, res)) return;
  const id = Number(req.params.id);
  const parsed = UpdateAdmin.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const update: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) update.displayName = parsed.data.displayName;
  if (parsed.data.password)    update.passwordHash = await hashPassword(parsed.data.password);
  if (parsed.data.permissions !== undefined) update.permissions = parsed.data.permissions;
  const admin = await Admin.findOneAndUpdate({ id }, { $set: update }, { new: true });
  if (!admin) { res.status(404).json({ error: "غير موجود" }); return; }
  const j = admin.toJSON() as Record<string, unknown>;
  delete j.passwordHash;
  res.json(j);
});

router.delete("/admin-accounts/:id", async (req, res) => {
  if (!guard(req, res)) return;
  const id = Number(req.params.id);
  const admin = await Admin.findOne({ id });
  if (!admin) { res.status(404).json({ error: "غير موجود" }); return; }
  if (admin.get("isSuperAdmin")) { res.status(403).json({ error: "لا يمكن حذف المدير الرئيسي" }); return; }
  await Admin.deleteOne({ id });
  res.status(204).send();
});

export default router;
