import { Router } from "express";
import { Player, Subscription, Employee, Salary, Expense } from "../db/models.js";

const router = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const in7   = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const [totalPlayers, activeSubscriptions, expiringSoon, totalEmployees, revenueDocs, expenseDocs] = await Promise.all([
    Player.countDocuments(),
    Subscription.countDocuments({ status: "active" }),
    Subscription.countDocuments({ endDate: { $gte: today, $lte: in7 }, status: { $ne: "expired" } }),
    Employee.countDocuments(),
    Subscription.find({ status: "active" }, { amount: 1 }),
    Expense.find({}, { amount: 1 }),
  ]);

  const totalRevenue  = revenueDocs.reduce((s, d) => s + Number(d.get("amount")), 0);
  const totalExpenses = expenseDocs.reduce((s, d) => s + Number(d.get("amount")), 0);

  res.json({ totalPlayers, activeSubscriptions, expiringSoon, totalEmployees, totalRevenue, totalExpenses });
});

router.get("/dashboard/finance-summary", async (_req, res) => {
  const [rentDocs, purchaseDocs, dailyDocs, salaryDocs] = await Promise.all([
    Expense.find({ category: "rent" },     { amount: 1 }),
    Expense.find({ category: "purchase" }, { amount: 1 }),
    Expense.find({ category: "daily" },    { amount: 1 }),
    Salary.find({},                        { amount: 1 }),
  ]);

  const sum = (docs: { get(k: string): unknown }[]) =>
    docs.reduce((s, d) => s + Number(d.get("amount")), 0);

  const totalRent      = sum(rentDocs);
  const totalPurchases = sum(purchaseDocs);
  const totalDaily     = sum(dailyDocs);
  const totalSalaries  = sum(salaryDocs);

  res.json({ totalRent, totalPurchases, totalDaily, totalSalaries, grandTotal: totalRent + totalPurchases + totalDaily + totalSalaries });
});

export default router;
