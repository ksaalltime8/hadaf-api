import { Router } from "express";
import { z } from "zod";
import { Employee, nextId } from "../db/models.js";

const router = Router();

const CreateEmployee = z.object({
  name:        z.string().min(2),
  role:        z.string().min(1),
  phone:       z.string().min(9),
  bankAccount: z.string().optional(),
  salary:      z.union([z.string(), z.number()]),
  notes:       z.string().optional(),
});
const UpdateEmployee = CreateEmployee.partial();

router.get("/employees", async (_req, res) => {
  const employees = await Employee.find().sort({ createdAt: 1 });
  res.json(employees.map(e => e.toJSON()));
});

router.post("/employees", async (req, res) => {
  const parsed = CreateEmployee.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { name, role, phone, bankAccount, salary, notes } = parsed.data;
  const id = await nextId("employees");
  const employee = await Employee.create({ id, name, role, phone, bankAccount: bankAccount ?? null, salary: String(salary), notes: notes ?? null });
  res.status(201).json(employee.toJSON());
});

router.get("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const employee = await Employee.findOne({ id });
  if (!employee) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(employee.toJSON());
});

router.patch("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateEmployee.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.salary !== undefined) update.salary = String(parsed.data.salary);
  const employee = await Employee.findOneAndUpdate({ id }, { $set: update }, { new: true });
  if (!employee) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(employee.toJSON());
});

router.delete("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await Employee.deleteOne({ id });
  res.status(204).send();
});

export default router;
