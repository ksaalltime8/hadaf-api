import { Router } from "express";
import { z } from "zod";
import { Salary, Employee, nextId } from "../db/models.js";

const router = Router();

const CreateSalary = z.object({
  employeeId: z.number(),
  amount:     z.union([z.string(), z.number()]),
  period:     z.string(),
  notes:      z.string().optional(),
});

router.get("/salaries", async (_req, res) => {
  const salaries = await Salary.find().sort({ paidAt: 1 });
  const enriched = await Promise.all(
    salaries.map(async s => {
      const j = s.toJSON() as { employeeId: number; [k: string]: unknown };
      const emp = await Employee.findOne({ id: j.employeeId });
      return { ...j, employeeName: emp?.get("name") ?? "غير معروف" };
    })
  );
  res.json(enriched);
});

router.post("/salaries", async (req, res) => {
  const parsed = CreateSalary.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { employeeId, amount, period, notes } = parsed.data;
  const id = await nextId("salaries");
  const salary = await Salary.create({ id, employeeId, amount: String(amount), period, notes: notes ?? null });
  const emp = await Employee.findOne({ id: employeeId });
  res.status(201).json({ ...salary.toJSON(), employeeName: emp?.get("name") ?? "غير معروف" });
});

router.delete("/salaries/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await Salary.deleteOne({ id });
  res.status(204).send();
});

export default router;
