import { Router } from "express";
import { z } from "zod";
import { Player, Subscription, nextId } from "../db/models.js";

const router = Router();

const CreatePlayer = z.object({
  name:          z.string().min(2),
  age:           z.number().nullable().optional(),
  position:      z.string().optional(),
  guardianName:  z.string().min(2),
  guardianPhone: z.string().min(9),
  notes:         z.string().optional(),
});
const UpdatePlayer = CreatePlayer.partial();

router.get("/players", async (_req, res) => {
  const players = await Player.find().sort({ createdAt: 1 });
  res.json(players.map(p => p.toJSON()));
});

router.post("/players", async (req, res) => {
  const parsed = CreatePlayer.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const id = await nextId("players");
  const player = await Player.create({ id, ...parsed.data, age: parsed.data.age ?? null, position: parsed.data.position ?? null, notes: parsed.data.notes ?? null });
  res.status(201).json(player.toJSON());
});

router.get("/players/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const player = await Player.findOne({ id });
  if (!player) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(player.toJSON());
});

router.patch("/players/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdatePlayer.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const player = await Player.findOneAndUpdate({ id }, { $set: parsed.data }, { new: true });
  if (!player) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(player.toJSON());
});

router.delete("/players/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await Player.deleteOne({ id });
  await Subscription.deleteMany({ playerId: id });
  res.status(204).send();
});

export default router;
