import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  execute,
  query,
  withTransaction,
} from "@/lib/mysql/pool";
import {
  newId,
  nowIso,
  quoteIdent,
  serializeRows,
  toMysqlParam,
} from "@/lib/mysql/helpers";
import type { PaymentMethod } from "@/lib/types";
import type {
  DbFilter,
  DbOrder,
  DbQueryPlan,
} from "@/lib/mysql/types";
import {
  planPeriodEnd,
  planPrice,
  type BillingCycle,
  type PlanName,
} from "@/lib/plans";

export const SESSION_COOKIE = "kai_session";
const SESSION_TTL_DAYS = 30;

export type { DbFilter, DbOrder, DbQueryPlan };

export interface DbInsertPlan {
  table: string;
  payload: Record<string, unknown>;
}

export interface DbUpdatePlan {
  table: string;
  payload: Record<string, unknown>;
  filters?: DbFilter[];
}

export interface DbDeletePlan {
  table: string;
  filters?: DbFilter[];
}

// ---------------------------------------------------------------
// Password hashing (scrypt, salted)
// ---------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, "hex"), candidate);
}

// ---------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  await execute(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
    [token, userId, expiresAt.toISOString().slice(0, 19).replace("T", " ")]
  );
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE token = ?", [token]);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export interface MysqlUserRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_platform_admin: boolean;
  created_at: string;
}

export async function getUserByToken(
  token: string
): Promise<MysqlUserRow | null> {
  const rows = await query<MysqlUserRow[]>(
    `SELECT u.id, u.email, u.full_name, u.phone, u.is_platform_admin, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW()`,
    [token]
  );
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<MysqlUserRow | null> {
  const rows = await query<MysqlUserRow[]>(
    "SELECT id, email, full_name, phone, is_platform_admin, created_at FROM users WHERE id = ?",
    [id]
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------
// Scoping helpers — replicate Supabase RLS
// ---------------------------------------------------------------
const RESTAURANT_SCOPED = new Set([
  "categories",
  "products",
  "orders",
  "order_counters",
  "tables",
  "ingredients",
  "recipes",
  "inventory_transactions",
  "expenses",
]);

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const rows = await query<{ is_platform_admin: number }[]>(
    "SELECT is_platform_admin FROM users WHERE id = ?",
    [userId]
  );
  return Boolean(rows[0]?.is_platform_admin);
}

async function restaurantScope(userId: string): Promise<{
  sql: string;
  params: unknown[];
}> {
  const rows = await query<{ restaurant_id: string }[]>(
    "SELECT restaurant_id FROM staff WHERE user_id = ? AND is_active = 1",
    [userId]
  );
  if (rows.length === 0) return { sql: "1 = 0", params: [] };
  const ids = rows.map((r) => r.restaurant_id);
  return {
    sql: `restaurant_id IN (${ids.map(() => "?").join(", ")})`,
    params: ids,
  };
}

async function scopeFor(
  table: string,
  userId: string
): Promise<{ sql: string; params: unknown[] }> {
  // Platform admins can read and write across the whole platform.
  if (await isPlatformAdmin(userId)) return { sql: "1 = 1", params: [] };
  if (RESTAURANT_SCOPED.has(table)) return restaurantScope(userId);
  if (table === "order_items" || table === "payments") {
    const scope = await restaurantScope(userId);
    return {
      sql: `order_id IN (SELECT id FROM orders WHERE ${scope.sql})`,
      params: scope.params,
    };
  }
  if (table === "restaurants") {
    const scope = await restaurantScope(userId);
    return {
      sql: `id IN (SELECT restaurant_id FROM staff WHERE user_id = ? AND is_active = 1)`,
      params: [userId],
    };
  }
  if (table === "businesses") {
    return {
      sql: `(owner_id = ? OR id IN (SELECT business_id FROM restaurants WHERE id IN (SELECT restaurant_id FROM staff WHERE user_id = ? AND is_active = 1)))`,
      params: [userId, userId],
    };
  }
  if (table === "staff") {
    const scope = await restaurantScope(userId);
    return {
      sql: `restaurant_id IN (${scope.params.map(() => "?").join(", ")})`,
      params: scope.params,
    };
  }
  if (table === "users") {
    return {
      sql: `(id = ? OR id IN (
        SELECT user_id FROM staff
        WHERE restaurant_id IN (
          SELECT restaurant_id FROM staff WHERE user_id = ? AND is_active = 1
        )
      ))`,
      params: [userId, userId],
    };
  }
  return { sql: "1 = 0", params: [] };
}

function buildFilterSql(filters: DbFilter[]): {
  sql: string;
  params: unknown[];
} {
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const f of filters) {
    const col = quoteIdent(f.field);
    switch (f.op) {
      case "eq":
        parts.push(`${col} = ?`);
        params.push(toMysqlParam(f.value));
        break;
      case "neq":
        parts.push(`${col} <> ?`);
        params.push(toMysqlParam(f.value));
        break;
      case "gte":
        parts.push(`${col} >= ?`);
        params.push(toMysqlParam(f.value));
        break;
      case "lte":
        parts.push(`${col} <= ?`);
        params.push(toMysqlParam(f.value));
        break;
      case "gt":
        parts.push(`${col} > ?`);
        params.push(toMysqlParam(f.value));
        break;
      case "lt":
        parts.push(`${col} < ?`);
        params.push(toMysqlParam(f.value));
        break;
      case "in": {
        const arr = Array.isArray(f.value) ? f.value : [f.value];
        parts.push(`${col} IN (${arr.map(() => "?").join(", ")})`);
        params.push(...arr.map(toMysqlParam));
        break;
      }
    }
  }
  return { sql: parts.join(" AND "), params };
}

function buildOrderSql(order: DbOrder[]): string {
  return order
    .map((o) => `${quoteIdent(o.col)} ${o.asc ? "ASC" : "DESC"}`)
    .join(", ");
}

// Attach relations from select strings like "*, order_items(*), payments(*)",
// "*, category:categories(name)".
async function attachRelations(
  table: string,
  select: string,
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return rows;
  const out = rows.map((r) => ({ ...r }));

  if (select.includes("order_items(*)")) {
    const ids = out.map((r) => r.id);
    const itemRows = await query(
      `SELECT * FROM order_items WHERE order_id IN (${ids
        .map(() => "?")
        .join(", ")})`,
      ids
    );
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const it of itemRows as Record<string, unknown>[]) {
      const key = String(it.order_id);
      const arr = grouped.get(key) ?? [];
      arr.push(it);
      grouped.set(key, arr);
    }
    for (const r of out) r.order_items = grouped.get(String(r.id)) ?? [];
  }

  if (select.includes("payments(*)")) {
    const ids = out.map((r) => r.id);
    const payRows = await query(
      `SELECT * FROM payments WHERE order_id IN (${ids
        .map(() => "?")
        .join(", ")})`,
      ids
    );
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const p of payRows as Record<string, unknown>[]) {
      const key = String(p.order_id);
      const arr = grouped.get(key) ?? [];
      arr.push(p);
      grouped.set(key, arr);
    }
    for (const r of out) r.payments = grouped.get(String(r.id)) ?? [];
  }

  if (select.includes("category:categories(name)")) {
    const ids = out
      .map((r) => r.category_id)
      .filter((v): v is string => Boolean(v));
    if (ids.length > 0) {
      const catRows = await query<{ id: string; name: string }[]>(
        `SELECT id, name FROM categories WHERE id IN (${ids
          .map(() => "?")
          .join(", ")})`,
        ids
      );
      const nameById = new Map(catRows.map((c) => [c.id, c.name]));
      for (const r of out)
        r.category_name = r.category_id ? nameById.get(String(r.category_id)) ?? null : null;
    } else {
      for (const r of out) r.category_name = null;
    }
  }

  return out;
}

function pickColumns(select: string | undefined): string {
  if (!select || select === "*") return "*";
  const tokens = select
    .split(",")
    .map((t) => t.trim())
    .filter((t) => !t.includes("("));
  const cols = tokens.length > 0 ? tokens : ["*"];
  return cols.map((t) => (t === "*" ? "*" : quoteIdent(t))).join(", ");
}

// ---------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------
export async function execSelect(
  plan: DbQueryPlan
): Promise<{ data: unknown; error: null }> {
  const userId = await requireUser().then((u) => u.id);
  const scope = await scopeFor(plan.table, userId);
  const filter = buildFilterSql(plan.filters ?? []);
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (scope.sql) {
    clauses.push(scope.sql);
    params.push(...scope.params);
  }
  if (filter.sql) {
    clauses.push(filter.sql);
    params.push(...filter.params);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const order = plan.order && plan.order.length > 0
    ? `ORDER BY ${buildOrderSql(plan.order)}`
    : "";
  let limitSql = "";
  if (plan.limit) limitSql = `LIMIT ${Number(plan.limit)}`;

  const rows = await query(
    `SELECT ${pickColumns(plan.select)} FROM ${quoteIdent(plan.table)} ${where} ${order} ${limitSql}`,
    params
  );

  const hydrated = await attachRelations(
    plan.table,
    plan.select ?? "*",
    rows as Record<string, unknown>[]
  );
  const serialized = serializeRows(hydrated);

  if (plan.single) return { data: serialized[0] ?? null, error: null };
  return { data: serialized, error: null };
}

export async function execInsert(
  plan: DbInsertPlan
): Promise<{ data: unknown; error: null }> {
  const userId = await requireUser().then((u) => u.id);
  if (RESTAURANT_SCOPED.has(plan.table) && plan.table !== "order_counters") {
    const scope = await restaurantScope(userId);
    const payload = { ...plan.payload };
    const scopeIds = scope.params as string[];
    if (
      payload.restaurant_id &&
      !scopeIds.includes(String(payload.restaurant_id))
    ) {
      throw new Error("Not allowed to write to this restaurant.");
    }
    const row: Record<string, unknown> = {
      id: newId(),
      ...payload,
      created_at: nowIso(),
    };
    if (!row.restaurant_id) row.restaurant_id = scopeIds[0];
    const cols = Object.keys(row);
    const colList = cols.map((c) => quoteIdent(c)).join(", ");
    const placeholders = cols.map(() => "?").join(", ");
    await execute(
      `INSERT INTO ${quoteIdent(plan.table)} (${colList}) VALUES (${placeholders})`,
      cols.map((c) => toMysqlParam(row[c]))
    );
    return { data: [row], error: null };
  }
  if (plan.table === "restaurants" || plan.table === "users") {
    const row: Record<string, unknown> = {
      id: newId(),
      ...plan.payload,
      created_at: nowIso(),
    };
    const cols = Object.keys(row);
    await execute(
      `INSERT INTO ${quoteIdent(plan.table)} (${cols
        .map((c) => quoteIdent(c))
        .join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      cols.map((c) => toMysqlParam(row[c]))
    );
    return { data: [row], error: null };
  }
  throw new Error(`Insert not supported for table: ${plan.table}`);
}

export async function execUpdate(
  plan: DbUpdatePlan
): Promise<{ data: unknown; error: null }> {
  const userId = await requireUser().then((u) => u.id);
  const scope = await scopeFor(plan.table, userId);
  const filter = buildFilterSql(plan.filters ?? []);
  const setCols = Object.keys(plan.payload);
  const setSql = setCols.map((c) => `${quoteIdent(c)} = ?`).join(", ");
  const clauses: string[] = [];
  const params: unknown[] = setCols.map((c) => toMysqlParam(plan.payload[c]));
  clauses.push(scope.sql);
  params.push(...scope.params);
  if (filter.sql) {
    clauses.push(filter.sql);
    params.push(...filter.params);
  }
  await execute(
    `UPDATE ${quoteIdent(plan.table)} SET ${setSql} WHERE ${clauses.join(" AND ")}`,
    params
  );
  return { data: [], error: null };
}

export async function execDelete(
  plan: DbDeletePlan
): Promise<{ data: unknown; error: null }> {
  const userId = await requireUser().then((u) => u.id);
  const scope = await scopeFor(plan.table, userId);
  const filter = buildFilterSql(plan.filters ?? []);
  const clauses: string[] = [scope.sql];
  const params: unknown[] = [...scope.params];
  if (filter.sql) {
    clauses.push(filter.sql);
    params.push(...filter.params);
  }
  await execute(
    `DELETE FROM ${quoteIdent(plan.table)} WHERE ${clauses.join(" AND ")}`,
    params
  );
  return { data: [], error: null };
}

// ---------------------------------------------------------------
// create_order RPC (mirrors the Postgres function)
// ---------------------------------------------------------------
export async function execCreateOrder(args: {
  v_restaurant_id: string;
  v_created_by: string;
  p_items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
  }[];
  v_method: PaymentMethod;
}): Promise<{ data: unknown; error: null }> {
  const order = await withTransaction(async (conn) => {
    const [taxRows] = await conn.query(
      "SELECT tax_rate FROM restaurants WHERE id = ?",
      [args.v_restaurant_id]
    ) as unknown as [Record<string, unknown>[]];
    const taxRate = Number(taxRows[0]?.tax_rate ?? 0);

    const subtotal = args.p_items.reduce(
      (sum, i) => sum + Number(i.quantity) * Number(i.unit_price),
      0
    );
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    // Next order number (monotonic per restaurant; daily view is by created_at).
    const [counterRows] = await conn.query(
      `SELECT last_number FROM order_counters WHERE restaurant_id = ?`,
      [args.v_restaurant_id]
    ) as unknown as [Record<string, unknown>[]];
    const orderNumber = Number(counterRows[0]?.last_number ?? 0) + 1;
    await conn.query(
      `INSERT INTO order_counters (restaurant_id, last_number)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_number = ?`,
      [args.v_restaurant_id, orderNumber, orderNumber]
    );

    const orderId = newId();
    const now = nowIso();
    await conn.query(
      `INSERT INTO orders
        (id, restaurant_id, table_id, order_number, status, subtotal, tax, total, created_by, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 'paid', ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        args.v_restaurant_id,
        orderNumber,
        subtotal,
        tax,
        total,
        args.v_created_by,
        now,
        now,
      ]
    );

    for (const item of args.p_items) {
      const itemId = newId();
      await conn.query(
        `INSERT INTO order_items
          (id, order_id, product_id, product_name, quantity, unit_price, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
        [
          itemId,
          orderId,
          item.product_id,
          item.product_name,
          Number(item.quantity),
          Number(item.unit_price),
          item.notes ?? null,
          now,
        ]
      );

      // Automatic stock deduction for recipe items.
      if (item.product_id) {
        const [recipeRows] = await conn.query(
          `SELECT ingredient_id, quantity_required
           FROM recipes WHERE product_id = ?`,
          [item.product_id]
        ) as unknown as [Record<string, unknown>[]];
        for (const recipe of recipeRows) {
          const deduct =
            Number(recipe.quantity_required) * Number(item.quantity);
          const [ingRows] = await conn.query(
            `SELECT id FROM ingredients WHERE id = ? AND restaurant_id = ?`,
            [recipe.ingredient_id, args.v_restaurant_id]
          ) as unknown as [Record<string, unknown>[]];
          if (ingRows.length === 0) continue;
          await conn.query(
            `UPDATE ingredients SET current_stock = current_stock - ?
             WHERE id = ? AND restaurant_id = ?`,
            [deduct, recipe.ingredient_id, args.v_restaurant_id]
          );
          await conn.query(
            `INSERT INTO inventory_transactions
              (id, restaurant_id, ingredient_id, type, quantity, reference, created_by, created_at)
             VALUES (?, ?, ?, 'sale', ?, ?, ?, ?)`,
            [
              newId(),
              args.v_restaurant_id,
              recipe.ingredient_id,
              deduct,
              `Order #${orderNumber}`,
              args.v_created_by,
              now,
            ]
          );
        }
      }
    }

    await conn.query(
      `INSERT INTO payments (id, order_id, method, amount, reference, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [newId(), orderId, args.v_method, total, now]
    );

    return {
      id: orderId,
      order_number: orderNumber,
      created_at: now,
    };
  });

  return { data: order, error: null };
}

// ---------------------------------------------------------------
// Kitchen Display System
// ---------------------------------------------------------------
export async function execAdvanceKitchen(args: {
  order_id: string;
  action: "preparing" | "ready" | "served";
}): Promise<{ data: unknown; error: null }> {
  const user = await requireUser();
  const scope = await restaurantScope(user.id);

  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, status FROM orders WHERE id = ? AND ${scope.sql}`,
      [args.order_id, ...scope.params]
    ) as unknown as [Record<string, unknown>[]];
    const order = rows[0];
    if (!order) throw new Error("Order not found.");

    // Stage is driven by the line items, matching the kitchen board's
    // grouping. Orders come in with status "paid" (charged at POS), so the
    // order status alone can't tell whether they are still "new".
    const [itemRows] = await conn.query(
      `SELECT status FROM order_items WHERE order_id = ?`,
      [args.order_id]
    ) as unknown as [{ status: string }[]];
    const stages = itemRows.map((r) => r.status);
    let from: "new" | "preparing" | "ready";
    if (stages.length === 0) {
      from = "new";
    } else if (stages.every((s) => s === "ready")) {
      from = "ready";
    } else if (stages.some((s) => s === "preparing")) {
      from = "preparing";
    } else {
      from = "new";
    }

    if (args.action === "preparing") {
      if (from !== "new") return;
      await conn.query(
        `UPDATE order_items SET status = 'preparing'
         WHERE order_id = ? AND status = 'new'`,
        [args.order_id]
      );
      await conn.query(
        `UPDATE orders SET status = 'preparing', updated_at = ? WHERE id = ?`,
        [nowIso(), args.order_id]
      );
    } else if (args.action === "ready") {
      await conn.query(
        `UPDATE order_items SET status = 'ready'
         WHERE order_id = ?`,
        [args.order_id]
      );
      await conn.query(
        `UPDATE orders SET status = 'ready', updated_at = ? WHERE id = ?`,
        [nowIso(), args.order_id]
      );
    } else if (args.action === "served") {
      await conn.query(
        `UPDATE orders SET status = 'served', updated_at = ? WHERE id = ?`,
        [nowIso(), args.order_id]
      );
    }
  });

  return { data: { ok: true }, error: null };
}

// ---------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------
export async function execRestockIngredient(args: {
  ingredient_id: string;
  quantity: number;
}): Promise<{ data: unknown; error: null }> {
  const user = await requireUser();
  const scope = await restaurantScope(user.id);

  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, restaurant_id FROM ingredients WHERE id = ? AND ${scope.sql}`,
      [args.ingredient_id, ...scope.params]
    ) as unknown as [Record<string, unknown>[]];
    const ing = rows[0];
    if (!ing) throw new Error("Ingredient not found.");
    const restaurantId = String(ing.restaurant_id);

    await conn.query(
      `UPDATE ingredients SET current_stock = current_stock + ?
       WHERE id = ?`,
      [Number(args.quantity), args.ingredient_id]
    );
    await conn.query(
      `INSERT INTO inventory_transactions
        (id, restaurant_id, ingredient_id, type, quantity, reference, created_by, created_at)
       VALUES (?, ?, ?, 'restock', ?, 'Manual restock', ?, ?)`,
      [
        newId(),
        restaurantId,
        args.ingredient_id,
        Number(args.quantity),
        user.id,
        nowIso(),
      ]
    );
  });

  return { data: { ok: true }, error: null };
}

export async function execAdjustIngredient(args: {
  ingredient_id: string;
  quantity: number;
  note?: string;
}): Promise<{ data: unknown; error: null }> {
  const user = await requireUser();
  const scope = await restaurantScope(user.id);

  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, current_stock, restaurant_id FROM ingredients WHERE id = ? AND ${scope.sql}`,
      [args.ingredient_id, ...scope.params]
    ) as unknown as [Record<string, unknown>[]];
    const ing = rows[0];
    if (!ing) throw new Error("Ingredient not found.");
    const restaurantId = String(ing.restaurant_id);
    const newStock = Number(args.quantity);
    const delta = newStock - Number(ing.current_stock);
    if (delta === 0) return;

    await conn.query(
      `UPDATE ingredients SET current_stock = ? WHERE id = ?`,
      [newStock, args.ingredient_id]
    );
    await conn.query(
      `INSERT INTO inventory_transactions
        (id, restaurant_id, ingredient_id, type, quantity, reference, created_by, created_at)
       VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?)`,
      [
        newId(),
        restaurantId,
        args.ingredient_id,
        delta,
        args.note ?? "Stock adjustment",
        user.id,
        nowIso(),
      ]
    );
  });

  return { data: { ok: true }, error: null };
}

// ---------------------------------------------------------------
// Staff management (owner only)
// ---------------------------------------------------------------
async function requireOwner(): Promise<{ user: MysqlUserRow; restaurantId: string }> {
  const user = await requireUser();
  const rows = await query<{ restaurant_id: string; role: string }[]>(
    `SELECT restaurant_id, role FROM staff WHERE user_id = ? AND is_active = 1`,
    [user.id]
  );
  const owner = rows.find((r) => r.role === "owner");
  if (!owner) throw new Error("Only the owner can manage staff.");
  return { user, restaurantId: owner.restaurant_id };
}

export async function execAddStaff(args: {
  email: string;
  full_name?: string;
  password?: string;
  role: string;
}): Promise<{ data: unknown; error: null }> {
  const { restaurantId } = await requireOwner();
  const normalizedEmail = args.email.toLowerCase().trim();
  if (!["owner", "manager", "cashier", "kitchen"].includes(args.role)) {
    throw new Error("Invalid role.");
  }
  if (args.password !== undefined && args.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  await withTransaction(async (conn) => {
    const [existingRows] = await conn.query(
      `SELECT id FROM users WHERE email = ?`,
      [normalizedEmail]
    ) as unknown as [Record<string, unknown>[]];

    let userId: string;
    if (existingRows[0]) {
      userId = String(existingRows[0].id);
    } else {
      if (!args.password) {
        throw new Error("A password is required for a new staff account.");
      }
      userId = newId();
      await conn.query(
        `INSERT INTO users (id, email, full_name, phone, password_hash, created_at)
         VALUES (?, ?, ?, NULL, ?, ?)`,
        [
          userId,
          normalizedEmail,
          args.full_name?.trim() || null,
          hashPassword(args.password),
          nowIso(),
        ]
      );
    }

    const [dupRows] = await conn.query(
      `SELECT id FROM staff WHERE restaurant_id = ? AND user_id = ?`,
      [restaurantId, userId]
    ) as unknown as [Record<string, unknown>[]];
    if (dupRows[0]) throw new Error("That person is already on staff.");

    await conn.query(
      `INSERT INTO staff (id, restaurant_id, user_id, role, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [newId(), restaurantId, userId, args.role, nowIso()]
    );
  });

  return { data: { ok: true }, error: null };
}

export async function execUpdateStaff(args: {
  staff_id: string;
  role?: string;
  is_active?: boolean;
}): Promise<{ data: unknown; error: null }> {
  const { restaurantId } = await requireOwner();
  const setCols: string[] = [];
  const params: unknown[] = [];
  if (args.role !== undefined) {
    if (!["owner", "manager", "cashier", "kitchen"].includes(args.role)) {
      throw new Error("Invalid role.");
    }
    setCols.push("role = ?");
    params.push(args.role);
  }
  if (args.is_active !== undefined) {
    setCols.push("is_active = ?");
    params.push(args.is_active ? 1 : 0);
  }
  if (setCols.length === 0) return { data: { ok: true }, error: null };

  await execute(
    `UPDATE staff SET ${setCols.join(", ")}
     WHERE id = ? AND restaurant_id = ? AND user_id != ?`,
    [...params, args.staff_id, restaurantId, (await requireUser()).id]
  );
  return { data: { ok: true }, error: null };
}

export async function execRemoveStaff(args: {
  staff_id: string;
}): Promise<{ data: unknown; error: null }> {
  const { restaurantId } = await requireOwner();
  await execute(
    `DELETE FROM staff WHERE id = ? AND restaurant_id = ? AND user_id != ?`,
    [args.staff_id, restaurantId, (await requireUser()).id]
  );
  return { data: { ok: true }, error: null };
}

// ---------------------------------------------------------------
// Auth helpers used by both the server client and the /api/db route
// ---------------------------------------------------------------
export async function authGetUser(): Promise<{
  data: { user: MysqlUserRow | null };
  error: null;
}> {
  const token = await getSessionToken();
  if (!token) return { data: { user: null }, error: null };
  const user = await getUserByToken(token);
  return { data: { user }, error: null };
}

export async function authSignInWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ data: { user: MysqlUserRow | null }; error: { message: string } | null }> {
  const rows = await query<{ id: string; password_hash: string; is_platform_admin: number }[]>(
    "SELECT id, password_hash, is_platform_admin FROM users WHERE email = ?",
    [email.toLowerCase().trim()]
  );
  const row = rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) {
    return {
      data: { user: null },
      error: { message: "Invalid login credentials" },
    };
  }
  // Platform admins bypass the per-business suspension check.
  if (!row.is_platform_admin) {
    const [active] = await query<{ active: number }[]>(
      `SELECT COUNT(*) AS active
       FROM staff s
       JOIN restaurants r ON r.id = s.restaurant_id
       JOIN businesses b ON b.id = r.business_id
       WHERE s.user_id = ? AND s.is_active = 1 AND b.is_active = 1`,
      [row.id]
    );
    if (!active?.active) {
      return {
        data: { user: null },
        error: { message: "Your account has been suspended." },
      };
    }
    // Owners of businesses with an unapproved or lapsed subscription are
    // allowed to sign in; getSessionContext routes them to the subscription
    // page so they can submit their payment proof.
  }
  const token = await createSession(row.id);
  await setSessionCookie(token);
  const user = await getUserById(row.id);
  return { data: { user }, error: null };
}

export async function authSignUp({
  email,
  password,
  options,
}: {
  email: string;
  password: string;
  options?: { data?: Record<string, string> };
}): Promise<{
  data: { user: MysqlUserRow | null; session: { access_token: string } };
  error: { message: string } | null;
}> {
  const fullName = options?.data?.full_name ?? "";
  const businessName =
    options?.data?.business_name ?? (fullName ? `${fullName}'s Cafe` : "My Cafe");
  const rawPlan = (options?.data?.plan ?? "starter").toLowerCase();
  const plan = ["starter", "business", "professional"].includes(rawPlan)
    ? (rawPlan as PlanName)
    : "starter";
  const rawCycle = (options?.data?.cycle ?? "monthly").toLowerCase();
  const cycle = ["monthly", "annual"].includes(rawCycle)
    ? (rawCycle as BillingCycle)
    : "monthly";
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await query(
    "SELECT id FROM users WHERE email = ?",
    [normalizedEmail]
  );
  if (existing.length > 0) {
    return {
      data: { user: null, session: { access_token: "" } },
      error: { message: "A user with this email already exists" },
    };
  }

  const userId = newId();
  const businessId = newId();
  const restaurantId = newId();
  const passwordHash = hashPassword(password);

  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO users (id, email, full_name, phone, password_hash, created_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [userId, normalizedEmail, fullName || null, passwordHash, nowIso()]
    );
    await conn.query(
      `INSERT INTO businesses (id, name, owner_id, plan, created_at) VALUES (?, ?, ?, ?, ?)`,
      [businessId, businessName, userId, plan, nowIso()]
    );
    await conn.query(
      `INSERT INTO restaurants (id, business_id, name, address, currency, tax_rate, created_at)
       VALUES (?, ?, ?, '', 'PGK', 0, ?)`,
      [restaurantId, businessId, businessName, nowIso()]
    );
    await conn.query(
      `INSERT INTO staff (id, restaurant_id, user_id, role, is_active, created_at)
       VALUES (?, ?, ?, 'owner', 1, ?)`,
      [newId(), restaurantId, userId, nowIso()]
    );

    const today = nowIso().slice(0, 10);
    await conn.query(
      `INSERT INTO subscriptions
        (id, business_id, plan, billing_cycle, price, status,
         current_period_start, current_period_end, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        newId(),
        businessId,
        plan,
        cycle,
        planPrice(plan, cycle),
        today,
        planPeriodEnd(today, cycle),
        nowIso(),
      ]
    );

    const catIds = {
      food: newId(),
      drinks: newId(),
      snacks: newId(),
      desserts: newId(),
    };
    const cats = [
      [catIds.food, "Food", 1],
      [catIds.drinks, "Drinks", 2],
      [catIds.snacks, "Snacks", 3],
      [catIds.desserts, "Desserts", 4],
    ];
    for (const [id, name, sort] of cats) {
      await conn.query(
        `INSERT INTO categories (id, restaurant_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
        [id, restaurantId, name, sort, nowIso()]
      );
    }

    const products = [
      [catIds.food, "Chicken Fried Rice", 25.0, 1],
      [catIds.food, "Fish & Chips", 32.0, 2],
      [catIds.food, "Chicken Steak", 38.0, 3],
      [catIds.food, "BBQ Pork Ribs", 42.0, 4],
      [catIds.drinks, "Coca-Cola (330ml)", 5.5, 1],
      [catIds.drinks, "Fresh Water (1.5L)", 5.0, 2],
      [catIds.drinks, "Mango Juice", 8.0, 3],
      [catIds.snacks, "Crisps", 4.0, 1],
      [catIds.snacks, "Chicken Roll", 12.0, 2],
      [catIds.desserts, "Ice Cream Sundae", 8.0, 1],
    ];
    for (const [catId, name, price, sort] of products) {
      await conn.query(
        `INSERT INTO products
          (id, restaurant_id, category_id, name, price, is_active, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [newId(), restaurantId, catId, name, price, sort, nowIso()]
      );
    }
  });

  const token = await createSession(userId);
  await setSessionCookie(token);
  const user = await getUserById(userId);
  return { data: { user, session: { access_token: token } }, error: null };
}

export async function authSignOut(): Promise<{ error: null }> {
  const token = await getSessionToken();
  if (token) await destroySession(token);
  await clearSessionCookie();
  return { error: null };
}

export async function requireUser(): Promise<MysqlUserRow> {
  const { data } = await authGetUser();
  if (!data.user) throw new Error("Unauthorized");
  return data.user;
}

// ---------------------------------------------------------------
// Platform administration
// ---------------------------------------------------------------
async function requirePlatformAdmin(): Promise<MysqlUserRow> {
  const user = await requireUser();
  if (!user.is_platform_admin) throw new Error("Forbidden");
  return user;
}

export async function execAdminOverview(): Promise<{
  data: unknown;
  error: null;
}> {
  await requirePlatformAdmin();
  const [overview] = await query<
    {
      businesses: number;
      active_businesses: number;
      restaurants: number;
      users: number;
      platform_admins: number;
      staff: number;
      orders: number;
      revenue: number;
    }[]
  >(
    `SELECT
       (SELECT COUNT(*) FROM businesses) AS businesses,
       (SELECT COUNT(*) FROM businesses WHERE is_active = 1) AS active_businesses,
       (SELECT COUNT(*) FROM restaurants) AS restaurants,
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM users WHERE is_platform_admin = 1) AS platform_admins,
       (SELECT COUNT(*) FROM staff WHERE is_active = 1) AS staff,
       (SELECT COUNT(*) FROM orders) AS orders,
       (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status <> 'cancelled') AS revenue`
  );
  return { data: overview ?? null, error: null };
}

export async function execAdminBusinesses(): Promise<{
  data: unknown;
  error: null;
}> {
  await requirePlatformAdmin();
  const rows = await query(
    `SELECT b.id, b.name, b.owner_id, b.plan, b.is_active, b.created_at,
            u.email AS owner_email,
            (SELECT COUNT(*) FROM restaurants r WHERE r.business_id = b.id) AS restaurant_count
     FROM businesses b
     LEFT JOIN users u ON u.id = b.owner_id
     ORDER BY b.created_at DESC`
  );
  return { data: serializeRows(rows as Record<string, unknown>[]), error: null };
}

export async function execAdminUsers(): Promise<{
  data: unknown;
  error: null;
}> {
  await requirePlatformAdmin();
  const rows = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.is_platform_admin, u.created_at,
            GROUP_CONCAT(
              CONCAT(b.name, ' · ', r.name, ' · ', s.role)
              ORDER BY b.name SEPARATOR '; '
            ) AS memberships
     FROM users u
     LEFT JOIN staff s ON s.user_id = u.id
     LEFT JOIN restaurants r ON r.id = s.restaurant_id
     LEFT JOIN businesses b ON b.id = r.business_id
     GROUP BY u.id, u.email, u.full_name, u.phone, u.is_platform_admin, u.created_at
     ORDER BY u.created_at DESC`
  );
  return { data: serializeRows(rows as Record<string, unknown>[]), error: null };
}

// ---------------------------------------------------------------
// Subscriptions & payment approvals
// ---------------------------------------------------------------
export async function execAdminSubscriptions(): Promise<{
  data: unknown;
  error: null;
}> {
  await requirePlatformAdmin();
  const rows = await query(
    `SELECT s.id, s.business_id, s.plan, s.billing_cycle, s.price, s.status,
            s.current_period_start, s.current_period_end, s.reminder_sent_at,
            DATEDIFF(s.current_period_end, CURDATE()) AS days_left,
            b.name AS business_name, u.email AS owner_email,
            (SELECT COUNT(*) FROM subscription_payments sp
             WHERE sp.subscription_id = s.id AND sp.status = 'pending') AS pending_payments
     FROM subscriptions s
     JOIN businesses b ON b.id = s.business_id
     LEFT JOIN users u ON u.id = b.owner_id
     ORDER BY s.current_period_end ASC`
  );
  return { data: serializeRows(rows as Record<string, unknown>[]), error: null };
}

export async function execAdminSubscriptionPayments(args: {
  subscription_id: string;
}): Promise<{ data: unknown; error: null }> {
  await requirePlatformAdmin();
  const rows = await query(
    `SELECT sp.id, sp.subscription_id, sp.amount, sp.method, sp.bank,
            sp.reference, sp.proof_url, sp.status, sp.created_at, sp.approved_at,
            u.email AS created_by_email
     FROM subscription_payments sp
     LEFT JOIN users u ON u.id = sp.created_by
     WHERE sp.subscription_id = ?
     ORDER BY sp.created_at DESC`,
    [args.subscription_id]
  );
  return { data: serializeRows(rows as Record<string, unknown>[]), error: null };
}

export async function execSubmitPayment(args: {
  subscription_id?: string;
  amount?: number;
  method: string;
  bank?: string;
  reference?: string;
  proof_url?: string;
}): Promise<{ data: unknown; error: null }> {
  const user = await requireUser();
  const [sub] = await query<{ id: string; business_id: string; price: number }[]>(
    `SELECT su.id, su.business_id, su.price
     FROM staff s
     JOIN restaurants r ON r.id = s.restaurant_id
     JOIN businesses b ON b.id = r.business_id
     JOIN subscriptions su ON su.business_id = b.id
     WHERE s.user_id = ? AND s.is_active = 1 AND b.is_active = 1
     LIMIT 1`,
    [user.id]
  );
  if (!sub) throw new Error("No active subscription found for your account.");
  const amount = args.amount ? Number(args.amount) : Number(sub.price);
  const method = ["cash", "eftpos", "bank_transfer", "online_bank_transfer", "mobile_banking", "bsp", "kina_bank", "anz", "westpac", "other"].includes(args.method)
    ? args.method
    : "bank_transfer";
  const bank = ["bsp", "kina_bank", "anz", "westpac", "other"].includes(args.bank ?? "")
    ? args.bank!
    : null;
  await execute(
    `INSERT INTO subscription_payments
      (id, subscription_id, business_id, amount, method, bank, reference, proof_url, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      newId(),
      sub.id,
      sub.business_id,
      amount,
      method,
      bank,
      args.reference ?? null,
      args.proof_url ?? null,
      user.id,
      nowIso(),
    ]
  );
  return { data: { ok: true }, error: null };
}

export async function execGetMyPayments(): Promise<{
  data: unknown;
  error: null;
}> {
  const user = await requireUser();
  const rows = await query(
    `SELECT sp.id, sp.subscription_id, sp.amount, sp.method, sp.bank,
            sp.reference, sp.proof_url, sp.status, sp.created_at, sp.approved_at
     FROM subscription_payments sp
     JOIN staff s ON s.user_id = ?
     JOIN restaurants r ON r.id = s.restaurant_id
     JOIN businesses b ON b.id = r.business_id
     JOIN subscriptions su ON su.business_id = b.id AND su.id = sp.subscription_id
     WHERE s.is_active = 1
     ORDER BY sp.created_at DESC`,
    [user.id]
  );
  return { data: serializeRows(rows as Record<string, unknown>[]), error: null };
}

export async function execAdminRecordPayment(args: {
  subscription_id: string;
  amount?: number;
  method: string;
  bank?: string;
  reference?: string;
}): Promise<{ data: unknown; error: null }> {
  const user = await requirePlatformAdmin();
  const [subs] = await query<{ business_id: string; price: number }[]>(
    "SELECT business_id, price FROM subscriptions WHERE id = ?",
    [args.subscription_id]
  );
  if (!subs) throw new Error("Subscription not found.");
  const amount = args.amount ? Number(args.amount) : Number(subs.price);
  const method = ["cash", "eftpos", "bank_transfer", "online_bank_transfer", "mobile_banking", "bsp", "kina_bank", "anz", "westpac", "other"].includes(args.method)
    ? args.method
    : "bank_transfer";
  const bank = ["bsp", "kina_bank", "anz", "westpac", "other"].includes(args.bank ?? "")
    ? args.bank!
    : null;
  await execute(
    `INSERT INTO subscription_payments
      (id, subscription_id, business_id, amount, method, bank, reference, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      newId(),
      args.subscription_id,
      subs.business_id,
      amount,
      method,
      bank,
      args.reference ?? null,
      user.id,
      nowIso(),
    ]
  );
  return { data: { ok: true }, error: null };
}

export async function execAdminApprovePayment(args: {
  payment_id: string;
}): Promise<{ data: unknown; error: null }> {
  const user = await requirePlatformAdmin();
  await withTransaction(async (conn) => {
    const [payRows] = await conn.query(
      `SELECT id, subscription_id, status FROM subscription_payments WHERE id = ?`,
      [args.payment_id]
    ) as unknown as [{ id: string; subscription_id: string; status: string }[]];
    const pay = payRows[0];
    if (!pay || pay.status !== "pending")
      throw new Error("Payment is not awaiting approval.");

    await conn.query(
      `UPDATE subscription_payments
       SET status = 'approved', approved_by = ?, approved_at = ?
       WHERE id = ?`,
      [user.id, nowIso(), pay.id]
    );

    const [subRows] = await conn.query(
      `SELECT plan, billing_cycle, status,
              DATE_FORMAT(current_period_end, '%Y-%m-%d') AS current_period_end
       FROM subscriptions WHERE id = ?`,
      [pay.subscription_id]
    ) as unknown as [
      {
        plan: PlanName;
        billing_cycle: BillingCycle;
        status: string;
        current_period_end: string;
      }[]
    ];
    const sub = subRows[0];
    if (!sub) return;

    const today = nowIso().slice(0, 10);
    const periodStart =
      sub.status === "active" && sub.current_period_end > today
        ? sub.current_period_end
        : today;
    const periodEnd = planPeriodEnd(periodStart, sub.billing_cycle);
    await conn.query(
      `UPDATE subscriptions
       SET status = 'active', current_period_start = ?, current_period_end = ?, reminder_sent_at = NULL
       WHERE id = ?`,
      [periodStart, periodEnd, pay.subscription_id]
    );
  });
  return { data: { ok: true }, error: null };
}

export async function execAdminRejectPayment(args: {
  payment_id: string;
}): Promise<{ data: unknown; error: null }> {
  const user = await requirePlatformAdmin();
  const [rows] = await query<{ status: string }[]>(
    "SELECT status FROM subscription_payments WHERE id = ?",
    [args.payment_id]
  );
  if (!rows || rows.status !== "pending")
    throw new Error("Payment is not awaiting approval.");
  await execute(
    `UPDATE subscription_payments
     SET status = 'rejected', approved_by = ?, approved_at = ?
     WHERE id = ?`,
    [user.id, nowIso(), args.payment_id]
  );
  return { data: { ok: true }, error: null };
}

export async function execAdminUpdateSubscription(args: {
  subscription_id: string;
  plan?: PlanName;
  billing_cycle?: BillingCycle;
}): Promise<{ data: unknown; error: null }> {
  await requirePlatformAdmin();
  const [rows] = await query<{
    plan: PlanName;
    billing_cycle: BillingCycle;
    business_id: string;
  }[]>(
    "SELECT plan, billing_cycle, business_id FROM subscriptions WHERE id = ?",
    [args.subscription_id]
  );
  if (!rows) throw new Error("Subscription not found.");

  const plan = args.plan ?? rows.plan;
  const cycle = args.billing_cycle ?? rows.billing_cycle;
  const price = planPrice(plan, cycle);
  const today = nowIso().slice(0, 10);

  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE subscriptions
       SET plan = ?, billing_cycle = ?, price = ?, status = 'active',
           current_period_start = ?, current_period_end = ?, reminder_sent_at = NULL
       WHERE id = ?`,
      [plan, cycle, price, today, planPeriodEnd(today, cycle), args.subscription_id]
    );
    await conn.query(
      `UPDATE businesses SET plan = ? WHERE id = ?`,
      [plan, rows.business_id]
    );
  });
  return { data: { ok: true }, error: null };
}

export async function execAdminSendReminder(args: {
  subscription_id: string;
  message: string;
}): Promise<{ data: unknown; error: null }> {
  await requirePlatformAdmin();
  const [rows] = await query<{ business_id: string; owner_id: string | null }[]>(
    `SELECT s.business_id, b.owner_id
     FROM subscriptions s
     JOIN businesses b ON b.id = s.business_id
     WHERE s.id = ?`,
    [args.subscription_id]
  );
  if (!rows) throw new Error("Subscription not found.");
  if (!rows.owner_id) throw new Error("Business has no owner.");

  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO notifications (id, user_id, message, link, created_at)
       VALUES (?, ?, ?, '/settings', ?)`,
      [newId(), rows.owner_id, args.message, nowIso()]
    );
    await conn.query(
      `UPDATE subscriptions SET reminder_sent_at = ? WHERE id = ?`,
      [nowIso(), args.subscription_id]
    );
  });
  return { data: { ok: true }, error: null };
}

// ---------------------------------------------------------------
// Notifications (owners see admin reminders)
// ---------------------------------------------------------------
export async function execGetNotifications(): Promise<{
  data: unknown;
  error: null;
}> {
  const user = await requireUser();
  const rows = await query(
    `SELECT id, message, link, read_at, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [user.id]
  );
  return { data: serializeRows(rows as Record<string, unknown>[]), error: null };
}

export async function execMarkNotificationsRead(): Promise<{
  data: unknown;
  error: null;
}> {
  const user = await requireUser();
  await execute(
    `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`,
    [nowIso(), user.id]
  );
  return { data: { ok: true }, error: null };
}

export async function execGetMySubscription(): Promise<{
  data: unknown;
  error: null;
}> {
  const user = await requireUser();
  const rows = await query(
    `SELECT su.id, su.plan, su.billing_cycle, su.price, su.status,
            DATE_FORMAT(su.current_period_start, '%Y-%m-%d') AS current_period_start,
            DATE_FORMAT(su.current_period_end, '%Y-%m-%d') AS current_period_end,
            b.name AS business_name
     FROM staff s
     JOIN restaurants r ON r.id = s.restaurant_id
     JOIN businesses b ON b.id = r.business_id
     JOIN subscriptions su ON su.business_id = b.id
     WHERE s.user_id = ? AND s.is_active = 1
     LIMIT 1`,
    [user.id]
  );
  return { data: serializeRows(rows as Record<string, unknown>[]), error: null };
}

// ---------------------------------------------------------------
// Landing page content (public read, admin write)
// ---------------------------------------------------------------
export async function execGetSiteContent(): Promise<{
  data: unknown;
  error: null;
}> {
  const rows = await query<{ id: string; value: string }[]>(
    "SELECT id, value FROM site_content"
  );
  const parsed = (rows ?? []).map((r) => {
    try {
      return { id: r.id, value: JSON.parse(r.value) };
    } catch {
      return { id: r.id, value: null };
    }
  });
  return { data: parsed, error: null };
}

export async function execUpdateSiteContent(args: {
  items: { id: string; value: Record<string, unknown> }[];
}): Promise<{ data: unknown; error: null }> {
  const user = await requirePlatformAdmin();
  await withTransaction(async (conn) => {
    for (const item of args.items) {
      await conn.query(
        `INSERT INTO site_content (id, value, updated_by, updated_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value = ?, updated_by = ?, updated_at = ?`,
        [
          item.id,
          JSON.stringify(item.value),
          user.id,
          nowIso(),
          JSON.stringify(item.value),
          user.id,
          nowIso(),
        ]
      );
    }
  });
  return { data: { ok: true }, error: null };
}