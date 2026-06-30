import { Router } from "express";
import authRouter         from "./auth.js";
import playersRouter      from "./players.js";
import subscriptionsRouter from "./subscriptions.js";
import employeesRouter    from "./employees.js";
import salariesRouter     from "./salaries.js";
import expensesRouter     from "./expenses.js";
import dashboardRouter    from "./dashboard.js";
import registrationsRouter from "./registrations.js";
import adminAccountsRouter from "./admin-accounts.js";
import settingsRouter     from "./settings.js";

const router = Router();

router.get("/healthz", (_req, res) => res.json({ status: "ok" }));

router.use(authRouter);
router.use(playersRouter);
router.use(subscriptionsRouter);
router.use(employeesRouter);
router.use(salariesRouter);
router.use(expensesRouter);
router.use(dashboardRouter);
router.use(registrationsRouter);
router.use(adminAccountsRouter);
router.use(settingsRouter);

export default router;
