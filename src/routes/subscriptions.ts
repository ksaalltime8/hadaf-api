import { Router } from "express";
import { z } from "zod";
import { Subscription, Player, nextId } from "../db/models.js";

const router = Router();

const CreateSub = z.object({
  playerId:  z.number(),
  amount:    z.union([z.string(), z.number()]),
  startDate: z.string(),
  endDate:   z.string(),
  notes:     z.string().optional(),
});
const UpdateSub = z.object({
  amount:    z.union([z.string(), z.number()]).optional(),
  startDate: z.string().optional(),
  endDate:   z.string().optional(),
  status:    z.enum(["active", "expired", "pending"]).optional(),
  notes:     z.string().optional(),
});

async function enrich(doc: Awaited<ReturnType<typeof Subscription.findOne>>) {
  if (!doc) return null;
  const s = doc.toJSON() as { playerId: number; [k: string]: unknown };
  const player = await Player.findOne({ id: s.playerId });
  return { ...s, playerName: player?.get("name") ?? "غير معروف", guardianPhone: player?.get("guardianPhone") ?? "" };
}

router.get("/subscriptions", async (_req, res) => {
  const subs = await Subscription.find().sort({ createdAt: 1 });
  res.json(await Promise.all(subs.map(s => enrich(s))));
});

router.get("/subscriptions/expiring-soon", async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const in7   = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const subs  = await Subscription.find({ endDate: { $gte: today, $lte: in7 }, status: { $ne: "expired" } }).sort({ endDate: 1 });
  res.json(await Promise.all(subs.map(s => enrich(s))));
});

router.post("/subscriptions", async (req, res) => {
  const parsed = CreateSub.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { playerId, amount, startDate, endDate, notes } = parsed.data;
  const id = await nextId("subscriptions");
  const sub = await Subscription.create({ id, playerId: Number(playerId), amount: String(amount), startDate, endDate, notes: notes ?? null, status: "active" });
  res.status(201).json(await enrich(sub));
});

router.get("/subscriptions/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const sub = await Subscription.findOne({ id });
  if (!sub) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(await enrich(sub));
});

router.patch("/subscriptions/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateSub.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.amount !== undefined) update.amount = String(parsed.data.amount);
  const sub = await Subscription.findOneAndUpdate({ id }, { $set: update }, { new: true });
  if (!sub) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(await enrich(sub));
});

router.delete("/subscriptions/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await Subscription.deleteOne({ id });
  res.status(204).send();
});

router.post("/subscriptions/:id/pay", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const sub = await Subscription.findOneAndUpdate({ id }, { $set: { paidAt: new Date(), status: "active" } }, { new: true });
  if (!sub) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(await enrich(sub));
});

export default router;
