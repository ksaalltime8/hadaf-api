import { Router } from "express";
import { z } from "zod";
import { Registration, nextId } from "../db/models.js";

const router = Router();

const CreateRegistration = z.object({
  playerName:           z.string().min(2),
  playerAge:            z.number().nullable().optional(),
  playerPosition:       z.string().optional(),
  subscriptionDuration: z.string().optional(),
  playerPhoto:          z.string().optional(),
  guardianName:         z.string().min(2),
  guardianPhone:        z.string().min(9),
  notes:                z.string().optional(),
});

const UpdateRegistration = CreateRegistration.extend({
  adminNote: z.string().nullable().optional(),
}).partial();

router.post("/registrations", async (req, res) => {
  const parsed = CreateRegistration.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const id = await nextId("registrations");
  const reg = await Registration.create({ id, ...parsed.data, status: "pending" });
  res.status(201).json(reg.toJSON());
});

router.get("/registrations", async (req, res) => {
  if (!req.session?.isAdmin) { res.status(401).json({ error: "Unauthorized" }); return; }
  const regs = await Registration.find().sort({ createdAt: -1 });
  res.json(regs.map(r => r.toJSON()));
});

router.patch("/registrations/:id/status", async (req, res) => {
  if (!req.session?.isAdmin) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id     = Number(req.params.id);
  const status = (req.body as { status?: string }).status ?? "";
  if (!["pending", "approved_temp", "approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "حالة غير صحيحة" }); return;
  }
  const update: Record<string, unknown> = { status };
  const { adminNote } = req.body as { adminNote?: string };
  if (adminNote !== undefined) update.adminNote = adminNote || null;
  const reg = await Registration.findOneAndUpdate({ id }, { $set: update }, { new: true });
  if (!reg) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(reg.toJSON());
});

router.patch("/registrations/:id", async (req, res) => {
  if (!req.session?.isAdmin) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  const parsed = UpdateRegistration.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const reg = await Registration.findOneAndUpdate({ id }, { $set: parsed.data }, { new: true });
  if (!reg) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(reg.toJSON());
});

router.delete("/registrations/:id", async (req, res) => {
  if (!req.session?.isAdmin) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  await Registration.deleteOne({ id });
  res.status(204).send();
});

export default router;
