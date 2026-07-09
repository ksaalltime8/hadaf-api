require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);
const app = express();

app.set('trust proxy', 1);

const allowedOrigins = [
  'https://hadafunited.com',
  'https://www.hadafunited.com',
  'https://27.hadafunited.com',
];

// Manual CORS — always sets headers before anything else
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ===== MONGODB ===== */
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URL;
if (!MONGO_URI) { console.error("MONGODB_URI not set"); process.exit(1); }

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000, socketTimeoutMS: 45000, family: 4 })
  .then(() => { console.log("MongoDB connected"); ensureAdmins(); })
  .catch(err => { console.error("MongoDB error:", err.message); process.exit(1); });

async function ensureAdmins() {
  try {
    // Remove accidental bootstrap "admin" account created by a bad deploy
    await Admin.deleteOne({ username: "admin", id: "1" });
    // Create k27 only if it doesn't already exist in the database
    const exists = await Admin.findOne({ username: "k27" });
    if (!exists) {
      const pw = process.env.ADMIN_PASSWORD || "q1w2e3r4t5";
      const passwordHash = await hashPassword(pw);
      await Admin.create({ id: "1", username: "k27", passwordHash, isSuperAdmin: true });
      console.log("k27 account created from database bootstrap.");
    } else {
      console.log("Admin accounts loaded from database — no changes made.");
    }
  } catch (err) { console.error("ensureAdmins error:", err.message); }
}

/* ===== SESSION ===== */
app.use(session({
  secret: process.env.SESSION_SECRET || "hadaf-secret-2024",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI, ttl: 7 * 24 * 60 * 60, autoRemove: "native" }),
  cookie: { secure: true, httpOnly: true, sameSite: "none", domain: ".hadafunited.com", maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

/* ===== MODELS ===== */
const NotifLogSchema = new mongoose.Schema({
  subscriptionId: String,
  daysBefore: Number,
  phone: String,
  date: String,
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });
const NotifLog = mongoose.model("NotifLog", NotifLogSchema);

const AdminSchema = new mongoose.Schema({
  id: String, username: { type: String, unique: true }, passwordHash: String,
  isSuperAdmin: { type: Boolean, default: false }, permissions: { type: [String], default: [] },
  role: { type: String, default: "" }, pushTokens: { type: [String], default: [] }
}, { timestamps: true });
const Admin = mongoose.model("Admin", AdminSchema);

const PlayerSchema = new mongoose.Schema({
  id: String, name: String, phone: String, age: Number,
  position: String, category: String, imageUrl: String,
  guardianName: String, guardianPhone: String, notes: String
}, { timestamps: true });
const Player = mongoose.model("Player", PlayerSchema);

const EmployeeSchema = new mongoose.Schema({
  id: String, name: String, phone: String, role: String,
  salary: Number, joinDate: String, imageUrl: String, notes: String,
  bankAccount: String
}, { timestamps: true });
const Employee = mongoose.model("Employee", EmployeeSchema);

const SubscriptionSchema = new mongoose.Schema({
  id: String, playerId: String, playerName: String,
  startDate: String, endDate: String, amount: Number,
  paid: { type: Boolean, default: false }, paidAt: Date,
  status: String,
  guardianName: String, guardianPhone: String, notes: String
}, { timestamps: true });
const Subscription = mongoose.model("Subscription", SubscriptionSchema);

const ExpenseSchema = new mongoose.Schema({
  id: String, description: String, amount: Number,
  category: String, date: String, notes: String
}, { timestamps: true });
const Expense = mongoose.model("Expense", ExpenseSchema);

const SalarySchema = new mongoose.Schema({
  id: String, employeeId: String, employeeName: String,
  month: Number, year: Number, amount: Number,
  paid: { type: Boolean, default: false }, paidAt: Date, notes: String
}, { timestamps: true });
const Salary = mongoose.model("Salary", SalarySchema);

const RegistrationSchema = new mongoose.Schema({
  id: String,
  playerName: String, playerAge: Number, playerPosition: String,
  playerPhoto: String, subscriptionDuration: String,
  guardianName: String, guardianPhone: String,
  name: String, age: Number, position: String,
  parentName: String, parentPhone: String, phone: String,
  status: { type: String, default: "pending" },
  adminNote: String, notes: String, submittedAt: Date
}, { timestamps: true });
const Registration = mongoose.model("Registration", RegistrationSchema);

const SettingsSchema = new mongoose.Schema({
  academyName: { type: String, default: "أكاديمية هدف يونايتد" },
  phone: String, email: String, address: String, logo: String,
  currency: { type: String, default: "SAR" },
  subscriptionDefaultDays: { type: Number, default: 30 },
  capital: String
});
const Settings = mongoose.model("Settings", SettingsSchema);

/* ===== HELPERS ===== */
async function hashPassword(p) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(p, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function verifyPassword(p, stored) {
  try {
    const [hash, salt] = stored.split(".");
    if (!hash || !salt) return false;
    const buf = await scryptAsync(p, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), buf);
  } catch { return false; }
}

function safeDate(val) {
  if (!val) return new Date().toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeReg(r) {
  const obj = r && r.toObject ? r.toObject() : Object.assign({}, r);
  if (!obj.playerName)    obj.playerName    = obj.name        || "";
  if (!obj.guardianName)  obj.guardianName  = obj.parentName  || "";
  if (!obj.guardianPhone) obj.guardianPhone = obj.parentPhone || obj.phone || "";
  if (!obj.playerAge)     obj.playerAge     = obj.age         || null;
  if (!obj.playerPosition)obj.playerPosition= obj.position    || null;
  obj.createdAt = safeDate(obj.createdAt || obj.submittedAt);
  obj.updatedAt = safeDate(obj.updatedAt);
  return obj;
}

function normalizeSubscription(r) {
  const obj = r && r.toObject ? r.toObject() : Object.assign({}, r);
  const today = new Date().toISOString().split("T")[0];
  if (!obj.status) {
    if (obj.paid) obj.status = "active";
    else if (obj.endDate && obj.endDate < today) obj.status = "expired";
    else obj.status = "pending";
  }
  return obj;
}

/* ===== AUTH MIDDLEWARE ===== */
function requireAuth(req, res, next) {
  if (!req.session?.username) return res.status(401).json({ ok: false, error: "غير مصرح" });
  next();
}
function requireSuperAdmin(req, res, next) {
  if (!req.session?.isSuperAdmin) return res.status(403).json({ ok: false, error: "ممنوع" });
  next();
}

/* ===== HEALTH ===== */
app.get("/api/health", (req, res) => {
  const s = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  res.json({ ok: true, db: s[mongoose.connection.readyState] || "unknown", time: new Date().toISOString() });
});

/* ===== PUSH NOTIFICATIONS ===== */
function httpPost(url, data) {
  return new Promise(resolve => {
    try {
      const body = JSON.stringify(data);
      const u = new URL(url);
      const req = https.request(
        { hostname: u.hostname, path: u.pathname, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
        res => { res.resume(); resolve(res.statusCode); }
      );
      req.on("error", () => resolve(0));
      req.write(body); req.end();
    } catch { resolve(0); }
  });
}
async function sendPush(title, body) {
  try {
    const admins = await Admin.find({ pushTokens: { $exists: true, $not: { $size: 0 } } });
    const tokens = admins.flatMap(a => a.pushTokens || [])
      .filter(t => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));
    if (!tokens.length) return;
    for (let i = 0; i < tokens.length; i += 100) {
      const messages = tokens.slice(i, i + 100).map(to => ({ to, title, body, sound: "default" }));
      await httpPost("https://exp.host/--/api/v2/push/send", messages);
    }
  } catch (err) { console.error("Push error:", err.message); }
}

/* ===== AUTH ROUTES ===== */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ ok: false, error: "بيانات ناقصة" });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ ok: false, error: "قاعدة البيانات غير متصلة" });
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ ok: false, error: "بيانات خاطئة" });
    if (!await verifyPassword(password, admin.passwordHash)) return res.status(401).json({ ok: false, error: "بيانات خاطئة" });
    req.session.username = admin.username;
    req.session.isSuperAdmin = admin.isSuperAdmin;
    req.session.permissions = admin.permissions;
    req.session.role = admin.role || "";
    req.session.save(() => res.json({ ok: true, username: admin.username, isSuperAdmin: admin.isSuperAdmin, permissions: admin.permissions, role: admin.role || "" }));
  } catch (err) { console.error("Login error:", err.message); res.status(500).json({ ok: false, error: "خطأ في الخادم" }); }
});

app.post("/api/auth/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/auth/me", (req, res) => {
  if (!req.session?.username) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, username: req.session.username, isSuperAdmin: req.session.isSuperAdmin || false, permissions: req.session.permissions || [], role: req.session.role || "" });
});

app.post("/api/auth/push-token", requireAuth, async (req, res) => {
  try {
    const { token, remove } = req.body;
    if (!token) return res.status(400).json({ ok: false });
    const op = remove ? { $pull: { pushTokens: token } } : { $addToSet: { pushTokens: token } };
    await Admin.findOneAndUpdate({ username: req.session.username }, op);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false }); }
});

/* ===== PLAYERS ===== */
app.get("/api/players", requireAuth, async (req, res) => {
  try { res.json(await Player.find({}).sort({ createdAt: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/players", requireAuth, async (req, res) => {
  try { res.json(await Player.create({ ...req.body, id: Date.now().toString() })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/players/:id", requireAuth, async (req, res) => {
  try {
    const p = await Player.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/players/:id", requireAuth, async (req, res) => {
  try { await Player.findOneAndDelete({ id: req.params.id }); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== EMPLOYEES ===== */
app.get("/api/employees", requireAuth, async (req, res) => {
  try { res.json(await Employee.find({}).sort({ createdAt: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/employees", requireAuth, async (req, res) => {
  try { res.json(await Employee.create({ ...req.body, id: Date.now().toString() })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/employees/:id", requireAuth, async (req, res) => {
  try {
    const e = await Employee.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!e) return res.status(404).json({ error: "غير موجود" });
    res.json(e);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/employees/:id", requireAuth, async (req, res) => {
  try { await Employee.findOneAndDelete({ id: req.params.id }); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});


/* ===== SUBSCRIPTIONS ===== */
function subFilter(id) {
  const filter = [{ id: id }];
  if (/^[0-9a-fA-F]{24}$/.test(id)) filter.push({ _id: id });
  return { $or: filter };
}

function normalizeSubscription(r) {
  const obj = r && r.toObject ? r.toObject() : Object.assign({}, r);
  // ensure custom id is always the _id string if not set
  if (!obj.id) obj.id = obj._id ? obj._id.toString() : obj.id;
  const today = new Date().toISOString().split("T")[0];
  if (!obj.status) {
    if (obj.paid) obj.status = "active";
    else if (obj.endDate && obj.endDate < today) obj.status = "expired";
    else obj.status = "pending";
  }
  return obj;
}

app.get("/api/subscriptions/expiring-soon", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const subs = await Subscription.find({ endDate: { $gte: today, $lte: future } }).lean();
    res.json(subs.map(normalizeSubscription));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get("/api/subscriptions", requireAuth, async (req, res) => {
  try {
    const subs = await Subscription.find({}).sort({ createdAt: -1 }).lean();
    res.json(subs.map(normalizeSubscription));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/subscriptions", requireAuth, async (req, res) => {
  try {
    const sub = await Subscription.create({ ...req.body, id: Date.now().toString() });
    res.json(normalizeSubscription(sub));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/subscriptions/:id", requireAuth, async (req, res) => {
  try {
    const s = await Subscription.findOneAndUpdate(subFilter(req.params.id), req.body, { new: true });
    if (!s) return res.status(404).json({ error: "غير موجود" });
    res.json(normalizeSubscription(s));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/subscriptions/:id/pay", requireAuth, async (req, res) => {
  try {
    const s = await Subscription.findOneAndUpdate(
      subFilter(req.params.id),
      { paid: true, paidAt: new Date(), status: "active" },
      { new: true }
    );
    if (!s) return res.status(404).json({ error: "غير موجود" });
    res.json(normalizeSubscription(s));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/subscriptions/:id", requireAuth, async (req, res) => {
  try {
    await Subscription.findOneAndDelete(subFilter(req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== EXPENSES ===== */
app.get("/api/expenses", requireAuth, async (req, res) => {
  try { res.json(await Expense.find({}).sort({ createdAt: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/expenses", requireAuth, async (req, res) => {
  try { res.json(await Expense.create({ ...req.body, id: Date.now().toString() })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/expenses/:id", requireAuth, async (req, res) => {
  try {
    const e = await Expense.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!e) return res.status(404).json({ error: "غير موجود" });
    res.json(e);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
  try { await Expense.findOneAndDelete({ id: req.params.id }); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== SALARIES ===== */
app.get("/api/salaries", requireAuth, async (req, res) => {
  try { res.json(await Salary.find({}).sort({ year: -1, month: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/salaries", requireAuth, async (req, res) => {
  try { res.json(await Salary.create({ ...req.body, id: Date.now().toString(), paidAt: new Date() })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/salaries/:id", requireAuth, async (req, res) => {
  try {
    const s = await Salary.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!s) return res.status(404).json({ error: "غير موجود" });
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/salaries/:id", requireAuth, async (req, res) => {
  try { await Salary.findOneAndDelete({ id: req.params.id }); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== DASHBOARD ===== */
app.get("/api/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const [
      totalPlayers,
      totalEmployees,
      activeSubscriptions,
      expiringSoon,
      paidSubs,
      expenses,
      salaries,
    ] = await Promise.all([
      Player.countDocuments(),
      Employee.countDocuments(),
      Subscription.countDocuments({ $or: [{ paid: true }, { status: "active" }] }),
      Subscription.countDocuments({ endDate: { $gte: today, $lte: future }, $or: [{ paid: true }, { status: "active" }] }),
      Subscription.find({ $or: [{ paid: true }, { status: "active" }] }, { amount: 1 }).lean(),
      Expense.find({}, { amount: 1 }).lean(),
      Salary.find({}, { amount: 1 }).lean(),
    ]);
    const totalRevenue  = paidSubs.reduce((s, x) => s + (x.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, x) => s + (x.amount || 0), 0)
                        + salaries.reduce((s, x) => s + (x.amount || 0), 0);
    res.json({ totalPlayers, activeSubscriptions, expiringSoon, totalEmployees, totalRevenue, totalExpenses });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/dashboard/finance-summary", requireAuth, async (req, res) => {
  try {
    const [expenses, salaries] = await Promise.all([
      Expense.find({}).lean(),
      Salary.find({ paid: true }).lean()
    ]);
    const totalRent      = expenses.filter(e => e.category === "rent")    .reduce((s, e) => s + (e.amount || 0), 0);
    const totalPurchases = expenses.filter(e => e.category === "purchase").reduce((s, e) => s + (e.amount || 0), 0);
    const totalDaily     = expenses.filter(e => e.category === "daily")   .reduce((s, e) => s + (e.amount || 0), 0);
    const totalSalaries  = salaries.reduce((s, e) => s + (e.amount || 0), 0);
    const grandTotal     = totalRent + totalPurchases + totalDaily + totalSalaries;
    res.json({ totalRent, totalPurchases, totalDaily, totalSalaries, grandTotal });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== REGISTRATIONS ===== */
app.get("/api/registrations", requireAuth, async (req, res) => {
  try {
    const regs = await Registration.find({}).sort({ createdAt: -1 }).lean();
    res.json(regs.map(normalizeReg));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/registrations", async (req, res) => {
  try {
    const reg = await Registration.create({ ...req.body, id: Date.now().toString() });
    res.status(201).json(normalizeReg(reg));
    sendPush("طلب تسجيل جديد 📋", `${req.body.playerName || req.body.name} — ولي الأمر: ${req.body.guardianName || req.body.parentName}`);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch("/api/registrations/:id/status", requireAuth, async (req, res) => {
  try {
    const update = { status: req.body.status };
    if (req.body.adminNote !== undefined) update.adminNote = req.body.adminNote;
    const r = await Registration.findOneAndUpdate({ id: req.params.id }, update, { new: true });
    if (!r) return res.status(404).json({ error: "غير موجود" });
    res.json(normalizeReg(r));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch("/api/registrations/:id", requireAuth, async (req, res) => {
  try {
    const r = await Registration.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!r) return res.status(404).json({ error: "غير موجود" });
    res.json(normalizeReg(r));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/registrations/:id", requireAuth, async (req, res) => {
  try {
    const r = await Registration.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!r) return res.status(404).json({ error: "غير موجود" });
    res.json(normalizeReg(r));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/registrations/:id", requireAuth, async (req, res) => {
  try { await Registration.findOneAndDelete({ id: req.params.id }); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== ADMIN ACCOUNTS ===== */
app.get("/api/admin-accounts", requireAuth, requireSuperAdmin, async (req, res) => {
  try { res.json(await Admin.find({}, { passwordHash: 0 })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/admin-accounts", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, isSuperAdmin, permissions, role } = req.body;
    if (await Admin.findOne({ username })) return res.status(400).json({ error: "المستخدم موجود" });
    const passwordHash = await hashPassword(password);
    const admin = await Admin.create({ id: Date.now().toString(), username, passwordHash, isSuperAdmin: isSuperAdmin || false, permissions: permissions || [], role: role || "" });
    const obj = admin.toObject(); delete obj.passwordHash; res.json(obj);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/admin-accounts/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    if (password) rest.passwordHash = await hashPassword(password);
    const admin = await Admin.findOneAndUpdate({ id: req.params.id }, rest, { new: true, projection: { passwordHash: 0 } });
    if (!admin) return res.status(404).json({ error: "غير موجود" });
    res.json(admin);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/admin-accounts/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try { await Admin.findOneAndDelete({ id: req.params.id }); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== SETTINGS ===== */
app.get("/api/settings", requireAuth, async (req, res) => {
  try { let s = await Settings.findOne(); if (!s) s = await Settings.create({}); res.json(s); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/settings", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    let s = await Settings.findOne(); if (!s) s = new Settings({});
    if (req.body.key && req.body.value !== undefined) {
      s[req.body.key] = req.body.value;
    } else {
      Object.assign(s, req.body);
    }
    await s.save(); res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


/* ===== LOOKUP (public — for my-subscription page) ===== */
app.get('/api/subscriptions/lookup', async (req, res) => {
  try {
    const phone = (req.query.phone || '').trim();
    if (!phone) return res.json([]);
    const subs = await Subscription.find({
      $or: [{ guardianPhone: phone }, { playerPhone: phone }]
    }).sort({ createdAt: -1 }).lean();
    res.json(subs.map(normalizeSubscription));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/registrations/lookup', async (req, res) => {
  try {
    const phone = (req.query.phone || '').trim();
    if (!phone) return res.json([]);
    const regs = await Registration.find({
      $or: [{ guardianPhone: phone }, { parentPhone: phone }, { phone: phone }]
    }).sort({ createdAt: -1 }).lean();
    res.json(regs.map(normalizeReg));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
/* ===== WHATSAPP NOTIFICATIONS ===== */
function normalizePhone(phone) {
  let p = (phone || '').replace(/\D/g, '');
  if (p.startsWith('05')) p = '966' + p.slice(1);
  else if (p.startsWith('5') && p.length === 9) p = '966' + p;
  if (!p.startsWith('966')) p = '966' + p;
  return p;
}

async function sendWhatsApp(phone, message) {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token) return false;
  const p = normalizePhone(phone);
  const body = new URLSearchParams({ token, to: p, body: message }).toString();
  const u = new URL(`https://api.ultramsg.com/${instanceId}/messages/chat`);
  return new Promise(resolve => {
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      res => { res.resume(); resolve(res.statusCode < 300); }
    );
    req.on('error', () => resolve(false));
    req.write(body); req.end();
  });
}

async function checkExpiringSubscriptions() {
  try {
    const NOTIFY_DAYS = [7, 3, 1];
    const today = new Date().toISOString().split('T')[0];
    let totalSent = 0;
    for (const days of NOTIFY_DAYS) {
      const target = new Date();
      target.setDate(target.getDate() + days);
      const targetStr = target.toISOString().split('T')[0];
      const subs = await Subscription.find({ endDate: targetStr, paid: true }).lean();
      for (const sub of subs) {
        if (!sub.guardianPhone) continue;
        const alreadySent = await NotifLog.findOne({ subscriptionId: sub._id.toString(), daysBefore: days, date: today });
        if (alreadySent) continue;
        const msg =
          `🏆 أكاديمية هدف يونايتد\n\n` +
          `مرحباً ${sub.guardianName || 'ولي الأمر'},\n` +
          `اشتراك *${sub.playerName}* سينتهي خلال *${days} ${days === 1 ? 'يوم' : 'أيام'}* بتاريخ ${sub.endDate}.\n\n` +
          `للتجديد تواصل معنا:\nwa.me/966579393080`;
        const sent = await sendWhatsApp(sub.guardianPhone, msg);
        if (sent) {
          await NotifLog.create({ subscriptionId: sub._id.toString(), daysBefore: days, phone: sub.guardianPhone, date: today });
          console.log(`WhatsApp sent: ${sub.playerName} → ${sub.guardianPhone} (${days}d left)`);
          totalSent++;
        }
      }
    }
    if (totalSent > 0) console.log(`Expiry check done — sent ${totalSent} notifications`);
  } catch (err) { console.error('checkExpiringSubscriptions error:', err.message); }
}

// Run at 09:00 AM Saudi time (06:00 UTC) every day
let _lastNotifDate = '';
setInterval(() => {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const today = now.toISOString().split('T')[0];
  if (utcHour === 6 && _lastNotifDate !== today) {
    _lastNotifDate = today;
    checkExpiringSubscriptions();
  }
}, 60 * 60 * 1000); // check every hour

// Admin endpoint to trigger manually & see log
app.post('/api/notifications/trigger', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await checkExpiringSubscriptions();
    res.json({ ok: true, message: 'تم تشغيل فحص الإشعارات' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.get('/api/notifications/log', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await NotifLog.find().sort({ sentAt: -1 }).limit(100).lean();
    res.json(logs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ===== SERVE REACT ===== */
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

/* ===== START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Server running on port", PORT));