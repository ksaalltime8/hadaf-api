import { Router } from "express";
import { z } from "zod";
import { Setting } from "../db/models.js";

const router = Router();

function guard(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]): boolean {
  if (!req.session?.isAdmin) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

router.get("/settings", async (req, res) => {
  if (!guard(req, res)) return;
  const settings = await Setting.find();
  const result: Record<string, string> = {};
  for (const s of settings) result[s.get("key")] = s.get("value");
  res.json(result);
});

router.put("/settings", async (req, res) => {
  if (!guard(req, res)) return;
  if (!req.session.isSuperAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = z.object({ key: z.string().min(1), value: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { key, value } = parsed.data;
  await Setting.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true });
  res.json({ ok: true, key, value });
});

export default router;
