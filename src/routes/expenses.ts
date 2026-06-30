import { Router } from "express";
import { z } from "zod";
import { Expense, nextId } from "../db/models.js";

const router = Router();

const CreateExpense = z.object({
  category:    z.enum(["rent", "purchase", "daily"]),
  description: z.string().min(1),
  amount:      z.union([z.string(), z.number()]),
  date:        z.string(),
  notes:       z.string().optional(),
});
const UpdateExpense = CreateExpense.partial();

router.get("/expenses", async (_req, res) => {
  const expenses = await Expense.find().sort({ date: 1 });
  res.json(expenses.map(e => e.toJSON()));
});

router.post("/expenses", async (req, res) => {
  const parsed = CreateExpense.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { category, description, amount, date, notes } = parsed.data;
  const id = await nextId("expenses");
  const expense = await Expense.create({ id, category, description, amount: String(amount), date, notes: notes ?? null });
  res.status(201).json(expense.toJSON());
});

router.patch("/expenses/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateExpense.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.amount !== undefined) update.amount = String(parsed.data.amount);
  const expense = await Expense.findOneAndUpdate({ id }, { $set: update }, { new: true });
  if (!expense) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(expense.toJSON());
});

router.delete("/expenses/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await Expense.deleteOne({ id });
  res.status(204).send();
});

export default router;
