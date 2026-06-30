import mongoose, { Schema } from "mongoose";

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model("Counter", counterSchema);

export async function nextId(name: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc!.seq;
}

function jsonTransform(_: unknown, ret: Record<string, unknown>) {
  delete ret._id;
  delete ret.__v;
  return ret;
}

// ── Player ──────────────────────────────────────────────────────────
const playerSchema = new Schema({
  id:            { type: Number, required: true, unique: true },
  name:          { type: String, required: true },
  age:           { type: Number, default: null },
  position:      { type: String, default: null },
  guardianName:  { type: String, required: true },
  guardianPhone: { type: String, required: true },
  notes:         { type: String, default: null },
  createdAt:     { type: Date,   default: Date.now },
});
playerSchema.set("toJSON", { transform: jsonTransform });
export const Player = mongoose.model("Player", playerSchema);

// ── Subscription ────────────────────────────────────────────────────
const subscriptionSchema = new Schema({
  id:        { type: Number, required: true, unique: true },
  playerId:  { type: Number, required: true },
  amount:    { type: String, required: true },
  startDate: { type: String, required: true },
  endDate:   { type: String, required: true },
  status:    { type: String, enum: ["active", "expired", "pending"], default: "active" },
  notes:     { type: String, default: null },
  paidAt:    { type: Date,   default: null },
  createdAt: { type: Date,   default: Date.now },
});
subscriptionSchema.set("toJSON", { transform: jsonTransform });
export const Subscription = mongoose.model("Subscription", subscriptionSchema);

// ── Employee ─────────────────────────────────────────────────────────
const employeeSchema = new Schema({
  id:          { type: Number, required: true, unique: true },
  name:        { type: String, required: true },
  role:        { type: String, required: true },
  phone:       { type: String, required: true },
  bankAccount: { type: String, default: null },
  salary:      { type: String, required: true },
  notes:       { type: String, default: null },
  createdAt:   { type: Date,   default: Date.now },
});
employeeSchema.set("toJSON", { transform: jsonTransform });
export const Employee = mongoose.model("Employee", employeeSchema);

// ── Salary ───────────────────────────────────────────────────────────
const salarySchema = new Schema({
  id:         { type: Number, required: true, unique: true },
  employeeId: { type: Number, required: true },
  amount:     { type: String, required: true },
  period:     { type: String, required: true },
  notes:      { type: String, default: null },
  paidAt:     { type: Date,   default: Date.now },
});
salarySchema.set("toJSON", { transform: jsonTransform });
export const Salary = mongoose.model("Salary", salarySchema);

// ── Admin Account ────────────────────────────────────────────────────
const adminSchema = new Schema({
  id:           { type: Number, required: true, unique: true },
  username:     { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  displayName:  { type: String, default: null },
  isSuperAdmin: { type: Boolean, default: false },
  permissions:  { type: [String], default: [] },
  createdAt:    { type: Date,   default: Date.now },
});
adminSchema.set("toJSON", { transform: jsonTransform });
export const Admin = mongoose.model("Admin", adminSchema);

// ── Setting ───────────────────────────────────────────────────────────
const settingSchema = new Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: String, required: true },
});
settingSchema.set("toJSON", { transform: jsonTransform });
export const Setting = mongoose.model("Setting", settingSchema);

// ── Registration ─────────────────────────────────────────────────────
const registrationSchema = new Schema({
  id:                   { type: Number, required: true, unique: true },
  playerName:           { type: String, required: true },
  playerAge:            { type: Number, default: null },
  playerPosition:       { type: String, default: null },
  subscriptionDuration: { type: String, default: null },
  playerPhoto:          { type: String, default: null },
  guardianName:         { type: String, required: true },
  guardianPhone:        { type: String, required: true },
  notes:                { type: String, default: null },
  status:               { type: String, enum: ["pending", "approved_temp", "approved", "rejected"], default: "pending" },
  adminNote:            { type: String, default: null },
  createdAt:            { type: Date,   default: Date.now },
});
registrationSchema.set("toJSON", { transform: jsonTransform });
export const Registration = mongoose.model("Registration", registrationSchema);

// ── Expense ──────────────────────────────────────────────────────────
const expenseSchema = new Schema({
  id:          { type: Number, required: true, unique: true },
  category:    { type: String, enum: ["rent", "purchase", "daily"], required: true },
  description: { type: String, required: true },
  amount:      { type: String, required: true },
  date:        { type: String, required: true },
  notes:       { type: String, default: null },
  createdAt:   { type: Date,   default: Date.now },
});
expenseSchema.set("toJSON", { transform: jsonTransform });
export const Expense = mongoose.model("Expense", expenseSchema);
