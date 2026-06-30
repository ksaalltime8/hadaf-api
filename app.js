const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);

const app = express();

/* ========================= MIDDLEWARE ========================= */
app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "hadaf-secret-2024",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

/* ========================= MONGODB ========================= */
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URL;
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    seedAdmin();
  })
  .catch(err => console.log("❌ MongoDB Error:", err.message));

/* ========================= MODELS ========================= */
const AdminSchema = new mongoose.Schema({
  id: String,
  username: { type: String, unique: true },
  passwordHash: String,
  isSuperAdmin: { type: Boolean, default: false },
  permissions: { type: [String], default: [] }
});
const Admin = mongoose.model("Admin", AdminSchema);

const PlayerSchema = new mongoose.Schema({
  id: String,
  name: String,
  phone: String,
  age: Number,
  position: String,
  category: String,
  imageUrl: String,
  notes: String
}, { timestamps: true });
const Player = mongoose.model("Player", PlayerSchema);

const EmployeeSchema = new mongoose.Schema({
  id: String,
  name: String,
  phone: String,
  role: String,
  salary: Number,
  joinDate: String,
  imageUrl: String,
  notes: String
}, { timestamps: true });
const Employee = mongoose.model("Employee", EmployeeSchema);

const SubscriptionSchema = new mongoose.Schema({
  id: String,
  playerId: String,
  playerName: String,
  startDate: String,
  endDate: String,
  amount: Number,
  paid: { type: Boolean, default: false }
}, { timestamps: true });
const Subscription = mongoose.model("Subscription", SubscriptionSchema);

const ExpenseSchema = new mongoose.Schema({
  id: String,
  description: String,
  amount: Number,
  category: String,
  date: String,
  notes: String
}, { timestamps: true });
const Expense = mongoose.model("Expense", ExpenseSchema);

const SalarySchema = new mongoose.Schema({
  id: String,
  employeeId: String,
  employeeName: String,
  month: Number,
  year: Number,
  amount: Number,
  paid: { type: Boolean, default: false },
  paidDate: String
}, { timestamps: true });
const Salary = mongoose.model("Salary", SalarySchema);

const RegistrationSchema = new mongoose.Schema({
  id: String,
  name: String,
  phone: String,
  age: Number,
  position: String,
  parentName: String,
  parentPhone: String,
  status: { type: String, default: "pending" },
  notes: String,
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });
const Registration = mongoose.model("Registration", RegistrationSchema);

const SettingsSchema = new mongoose.Schema({
  academyName: { type: String, default: "أكاديمية هدف يونايتد" },
  phone: String,
  email: String,
  address: String,
  logo: String,
  currency: { type: String, default: "SAR" },
  subscriptionDefaultDays: { type: Number, default: 30 }
});
const Settings = mongoose.model("Settings", SettingsSchema);

/* ========================= PASSWORD UTILS ========================= */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function verifyPassword(password, stored) {
  const [hash, salt] = stored.split(".");
  const buf = await scryptAsync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), buf);
}

/* ========================= SEED ADMIN ========================= */
async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || "k27";
  const password = process.env.ADMIN_PASSWORD || "q1w2e3r4t5";
  const existing = await Admin.findOne({ username });
  if (!existing) {
    const passwordHash = await hashPassword(password);
    await Admin.create({ id: "1", username, passwordHash, isSuperAdmin: true });
    console.log("✅ Admin created:", username);
  } else if (!existing.isSuperAdmin) {
    await Admin.findOneAndUpdate({ username }, { $set: { isSuperAdmin: true } });
  }
}

/* ========================= AUTH MIDDLEWARE ========================= */
function requireAuth(req, res, next) {
  if (!req.session.username) return res.status(401).json({ ok: false, error: "غير مصرح" });
  next();
}
function requireSuperAdmin(req, res, next) {
  if (!req.session.isSuperAdmin) return res.status(403).json({ ok: false, error: "ممنوع" });
  next();
}

/* ========================= HEALTH ========================= */
app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* ========================= AUTH ROUTES ========================= */
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ ok: false, error: "بيانات ناقصة" });
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(401).json({ ok: false, error: "بيانات خاطئة" });
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) return res.status(401).json({ ok: false, error: "بيانات خاطئة" });
  req.session.username = admin.username;
  req.session.isSuperAdmin = admin.isSuperAdmin;
  req.session.permissions = admin.permissions;
  req.session.save(() => res.json({ ok: true, username: admin.username, isSuperAdmin: admin.isSuperAdmin, permissions: admin.permissions }));
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.username) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, username: req.session.username, isSuperAdmin: req.session.isSuperAdmin || false, permissions: req.session.permissions || [] });
});

/* ========================= PLAYERS ========================= */
app.get("/api/players", requireAuth, async (req, res) => {
  const players = await Player.find({}).sort({ createdAt: -1 });
  res.json(players);
});
app.post("/api/players", requireAuth, async (req, res) => {
  const player = await Player.create({ ...req.body, id: Date.now().toString() });
  res.json(player);
});
app.put("/api/players/:id", requireAuth, async (req, res) => {
  const player = await Player.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
  if (!player) return res.status(404).json({ error: "غير موجود" });
  res.json(player);
});
app.delete("/api/players/:id", requireAuth, async (req, res) => {
  await Player.findOneAndDelete({ id: req.params.id });
  res.json({ ok: true });
});

/* ========================= EMPLOYEES ========================= */
app.get("/api/employees", requireAuth, async (req, res) => {
  const employees = await Employee.find({}).sort({ createdAt: -1 });
  res.json(employees);
});
app.post("/api/employees", requireAuth, async (req, res) => {
  const employee = await Employee.create({ ...req.body, id: Date.now().toString() });
  res.json(employee);
});
app.put("/api/employees/:id", requireAuth, async (req, res) => {
  const employee = await Employee.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
  if (!employee) return res.status(404).json({ error: "غير موجود" });
  res.json(employee);
});
app.delete("/api/employees/:id", requireAuth, async (req, res) => {
  await Employee.findOneAndDelete({ id: req.params.id });
  res.json({ ok: true });
});

/* ========================= SUBSCRIPTIONS ========================= */
app.get("/api/subscriptions/expiring-soon", requireAuth, async (req, res) => {
  const today = new Date();
  const in7days = new Date(today);
  in7days.setDate(today.getDate() + 7);
  const todayStr = today.toISOString().split("T")[0];
  const futureStr = in7days.toISOString().split("T")[0];
  const subs = await Subscription.find({ endDate: { $gte: todayStr, $lte: futureStr } });
  res.json(subs);
});
app.get("/api/subscriptions", requireAuth, async (req, res) => {
  const subs = await Subscription.find({}).sort({ createdAt: -1 });
  res.json(subs);
});
app.post("/api/subscriptions", requireAuth, async (req, res) => {
  const sub = await Subscription.create({ ...req.body, id: Date.now().toString() });
  res.json(sub);
});
app.put("/api/subscriptions/:id", requireAuth, async (req, res) => {
  const sub = await Subscription.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
  if (!sub) return res.status(404).json({ error: "غير موجود" });
  res.json(sub);
});
app.delete("/api/subscriptions/:id", requireAuth, async (req, res) => {
  await Subscription.findOneAndDelete({ id: req.params.id });
  res.json({ ok: true });
});

/* ========================= EXPENSES ========================= */
app.get("/api/expenses", requireAuth, async (req, res) => {
  const expenses = await Expense.find({}).sort({ createdAt: -1 });
  res.json(expenses);
});
app.post("/api/expenses", requireAuth, async (req, res) => {
  const expense = await Expense.create({ ...req.body, id: Date.now().toString() });
  res.json(expense);
});
app.put("/api/expenses/:id", requireAuth, async (req, res) => {
  const expense = await Expense.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
  if (!expense) return res.status(404).json({ error: "غير موجود" });
  res.json(expense);
});
app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
  await Expense.findOneAndDelete({ id: req.params.id });
  res.json({ ok: true });
});

/* ========================= SALARIES ========================= */
app.get("/api/salaries", requireAuth, async (req, res) => {
  const salaries = await Salary.find({}).sort({ year: -1, month: -1 });
  res.json(salaries);
});
app.post("/api/salaries", requireAuth, async (req, res) => {
  const salary = await Salary.create({ ...req.body, id: Date.now().toString() });
  res.json(salary);
});
app.put("/api/salaries/:id", requireAuth, async (req, res) => {
  const salary = await Salary.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
  if (!salary) return res.status(404).json({ error: "غير موجود" });
  res.json(salary);
});
app.delete("/api/salaries/:id", requireAuth, async (req, res) => {
  await Salary.findOneAndDelete({ id: req.params.id });
  res.json({ ok: true });
});

/* ========================= DASHBOARD ========================= */
app.get("/api/dashboard/summary", requireAuth, async (req, res) => {
  const [players, employees, subs, regs] = await Promise.all([
    Player.countDocuments(),
    Employee.countDocuments(),
    Subscription.countDocuments(),
    Registration.countDocuments({ status: "pending" })
  ]);
  const today = new Date();
  const in7days = new Date(today);
  in7days.setDate(today.getDate() + 7);
  const todayStr = today.toISOString().split("T")[0];
  const futureStr = in7days.toISOString().split("T")[0];
  const expiring = await Subscription.countDocuments({ endDate: { $gte: todayStr, $lte: futureStr } });
  res.json({ players, employees, subscriptions: subs, pendingRegistrations: regs, expiringSubscriptions: expiring });
});

app.get("/api/dashboard/finance-summary", requireAuth, async (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startOfMonth = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];
  const [expenses, salaries, subs] = await Promise.all([
    Expense.find({ date: { $gte: startOfMonth, $lte: endOfMonth } }),
    Salary.find({ month, year, paid: true }),
    Subscription.find({ paid: true, startDate: { $gte: startOfMonth } })
  ]);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalSalaries = salaries.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncome = subs.reduce((s, e) => s + (e.amount || 0), 0);
  res.json({ totalIncome, totalExpenses: totalExpenses + totalSalaries, netProfit: totalIncome - totalExpenses - totalSalaries, month, year });
});

/* ========================= REGISTRATIONS ========================= */
app.get("/api/registrations", requireAuth, async (req, res) => {
  const regs = await Registration.find({}).sort({ submittedAt: -1 });
  res.json(regs);
});
app.post("/api/registrations", async (req, res) => {
  const reg = await Registration.create({ ...req.body, id: Date.now().toString() });
  res.json(reg);
});
app.get("/api/registrations/:id", requireAuth, async (req, res) => {
  const reg = await Registration.findOne({ id: req.params.id });
  if (!reg) return res.status(404).json({ error: "غير موجود" });
  res.json(reg);
});
app.patch("/api/registrations/:id/status", requireAuth, async (req, res) => {
  const { status } = req.body;
  const reg = await Registration.findOneAndUpdate({ id: req.params.id }, { status }, { new: true });
  if (!reg) return res.status(404).json({ error: "غير موجود" });
  res.json(reg);
});
app.put("/api/registrations/:id", requireAuth, async (req, res) => {
  const reg = await Registration.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
  if (!reg) return res.status(404).json({ error: "غير موجود" });
  res.json(reg);
});
app.delete("/api/registrations/:id", requireAuth, async (req, res) => {
  await Registration.findOneAndDelete({ id: req.params.id });
  res.json({ ok: true });
});

/* ========================= ADMIN ACCOUNTS ========================= */
app.get("/api/admin-accounts", requireAuth, requireSuperAdmin, async (req, res) => {
  const admins = await Admin.find({}, { passwordHash: 0 });
  res.json(admins);
});
app.post("/api/admin-accounts", requireAuth, requireSuperAdmin, async (req, res) => {
  const { username, password, isSuperAdmin, permissions } = req.body;
  const exists = await Admin.findOne({ username });
  if (exists) return res.status(400).json({ error: "المستخدم موجود مسبقاً" });
  const passwordHash = await hashPassword(password);
  const admin = await Admin.create({ id: Date.now().toString(), username, passwordHash, isSuperAdmin: isSuperAdmin || false, permissions: permissions || [] });
  res.json({ ...admin.toObject(), passwordHash: undefined });
});
app.put("/api/admin-accounts/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const { password, ...rest } = req.body;
  const update = { ...rest };
  if (password) update.passwordHash = await hashPassword(password);
  const admin = await Admin.findOneAndUpdate({ id: req.params.id }, update, { new: true, projection: { passwordHash: 0 } });
  if (!admin) return res.status(404).json({ error: "غير موجود" });
  res.json(admin);
});
app.delete("/api/admin-accounts/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  await Admin.findOneAndDelete({ id: req.params.id });
  res.json({ ok: true });
});

/* ========================= SETTINGS ========================= */
app.get("/api/settings", requireAuth, async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  res.json(settings);
});
app.put("/api/settings", requireAuth, requireSuperAdmin, async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = new Settings({});
  Object.assign(settings, req.body);
  await settings.save();
  res.json(settings);
});

/* ========================= SERVE REACT APP ========================= */
const publicDir = path.join(__dirname, "public");
const fs = require("fs");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

/* ========================= START ========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port", PORT);
});
