import "server-only";

import { randomUUID } from "crypto";

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function quoteIdent(name: string): string {
  return "`" + name.replace(/`/g, "``") + "`";
}

const DATE_COLUMNS = new Set([
  "created_at",
  "updated_at",
  "expires_at",
]);

export function serializeRow<T extends Record<string, unknown>>(
  row: Record<string, unknown>
): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (Buffer.isBuffer(v)) {
      out[k] = v.toString("utf8");
    } else if (typeof v === "bigint") {
      out[k] = Number(v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export function serializeRows<T extends Record<string, unknown>>(
  rows: Record<string, unknown>[]
): T[] {
  return rows.map((r) => serializeRow<T>(r));
}

export function isDateColumn(col: string): boolean {
  return DATE_COLUMNS.has(col);
}

// Convert an ISO string filter value to a MySQL DATETIME literal-safe param.
export function toMysqlParam(value: unknown): unknown {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString().replace("T", " ").slice(0, 19);
  return value;
}