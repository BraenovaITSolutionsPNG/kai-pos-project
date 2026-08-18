"use client";

import type { PaymentMethod } from "@/lib/types";
import {
  getStore,
  saveTable,
  createDemoOrder,
  tableRows,
  type DemoRow,
} from "@/lib/demo/store";
import { DEMO_RESTAURANT, DEMO_BUSINESS } from "@/lib/demo/seed";

type Filter = {
  field: string;
  op: "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "in";
  value: unknown;
};

function matches(row: DemoRow, f: Filter): boolean {
  const v = row[f.field];
  switch (f.op) {
    case "eq":
      return v === f.value;
    case "neq":
      return v !== f.value;
    case "gte":
      return Number(v) >= Number(f.value);
    case "lte":
      return Number(v) <= Number(f.value);
    case "gt":
      return Number(v) > Number(f.value);
    case "lt":
      return Number(v) < Number(f.value);
    case "in":
      return Array.isArray(f.value) && f.value.includes(v as string);
    default:
      return true;
  }
}

function shapeRows(rows: DemoRow[], selectCols: string): DemoRow[] {
  if (selectCols.includes("order_items(*)")) {
    rows = rows.map((r) => ({ ...r, order_items: r.order_items ?? [] }));
  }
  if (selectCols.includes("payments(*)")) {
    rows = rows.map((r) => ({ ...r, payments: r.payments ?? [] }));
  }
  if (selectCols.includes("category:categories(name)")) {
    rows = rows.map((r) => ({ ...r, category_name: r.category_name ?? null }));
  }
  return rows;
}

class DemoQuery {
  private filters: Filter[] = [];
  private orderBy: { col: string; asc: boolean }[] = [];

  constructor(
    private rows: () => DemoRow[],
    private selectCols: string
  ) {}

  eq(field: string, value: unknown) {
    this.filters.push({ field, op: "eq", value });
    return this;
  }
  neq(field: string, value: unknown) {
    this.filters.push({ field, op: "neq", value });
    return this;
  }
  gte(field: string, value: unknown) {
    this.filters.push({ field, op: "gte", value });
    return this;
  }
  lte(field: string, value: unknown) {
    this.filters.push({ field, op: "lte", value });
    return this;
  }
  in(field: string, value: unknown[]) {
    this.filters.push({ field, op: "in", value });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ col, asc: opts?.ascending ?? true });
    return this;
  }

  private resolved(): DemoRow[] {
    let rows = this
      .rows()
      .filter((r) => this.filters.every((f) => matches(r, f)));

    for (const o of this.orderBy) {
      rows = [...rows].sort((a, b) => {
        const av = a[o.col];
        const bv = b[o.col];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "string" && typeof bv === "string") {
          return o.asc ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return o.asc ? Number(av) - Number(bv) : Number(bv) - Number(av);
      });
    }
    return rows;
  }

  private async resolve(): Promise<{ data: DemoRow[] | null; error: null }> {
    return { data: shapeRows(this.resolved(), this.selectCols), error: null };
  }

  single() {
    const [row] = this.resolved();
    return Promise.resolve({
      data: (row ? shapeRows([row], this.selectCols)[0] : null) as unknown,
      error: null,
    });
  }
  maybeSingle() {
    return this.single();
  }
  then(
    resolve: (value: { data: DemoRow[] | null; error: null }) => void
  ) {
    void this.resolve().then(resolve);
  }
  async limit(n: number) {
    this.orderBy = [];
    return (await this.resolve()).data?.slice(0, n) ?? [];
  }
}

class DemoMutation {
  private filters: Filter[] = [];
  constructor(
    private table: string,
    private rows: () => DemoRow[],
    private payload: Record<string, unknown> | null,
    private mode: "update" | "delete"
  ) {}

  eq(field: string, value: unknown) {
    this.filters.push({ field, op: "eq", value });
    return this;
  }

  private run(): { data: unknown; error: null } {
    const rows = this.rows();
    const matched = rows.filter((r) => this.filters.every((f) => matches(r, f)));
    if (this.mode === "update" && this.payload) {
      for (const r of matched) {
        Object.assign(r, this.payload);
      }
    } else if (this.mode === "delete") {
      for (const r of matched) {
        const idx = rows.indexOf(r);
        if (idx >= 0) rows.splice(idx, 1);
      }
    }
    saveTable(this.table, rows);
    return { data: this.mode === "update" ? matched : [], error: null };
  }

  single() {
    return Promise.resolve(this.run());
  }
  then(resolve: (value: { data: unknown; error: null }) => void) {
    resolve(this.run());
  }
}

function demoAuth() {
  const DEMO_SESSION_KEY = "kai_pos_demo_session";

  return {
    async getUser() {
      if (typeof window === "undefined") return { data: { user: null }, error: null };
      try {
        const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
        return raw
          ? { data: { user: JSON.parse(raw) }, error: null }
          : { data: { user: null }, error: null };
      } catch {
        return { data: { user: null }, error: null };
      }
    },
    async signUp({
      email,
      options,
    }: {
      email: string;
      options?: { data?: Record<string, string> };
    }) {
      const fullName = options?.data?.full_name ?? email;
      const user = {
        id: "demo-user",
        email,
        full_name: fullName,
        role: "owner",
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
      }
      return { data: { user, session: {} }, error: null };
    },
    async signInWithPassword({
      email,
    }: {
      email: string;
    }) {
      const full_name =
        email.replace(/@.*/, "").replace(/[^a-z0-9]/gi, " ") || "Demo User";
      const user = {
        id: "demo-user",
        email,
        full_name: full_name.replace(/\b\w/g, (c) => c.toUpperCase()),
        role: "owner",
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
      }
      return { data: { user, session: {} }, error: null };
    },
    async signOut() {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DEMO_SESSION_KEY);
      }
      return { error: null };
    },
  };
}

export function createDemoClient() {
  return {
    auth: demoAuth(),
    from(table: "categories" | "products" | "restaurants" | "orders") {
      return {
        select(cols = "*") {
          return new DemoQuery(
            () => tableRows(table),
            cols
          );
        },
        insert(value: Record<string, unknown>) {
          const rows = tableRows(table);
          const row: DemoRow = {
            ...value,
            id: `demo-${Math.random().toString(36).slice(2, 10)}`,
            created_at: new Date().toISOString(),
          };
          rows.push(row);
          saveTable(table, rows);
          return Promise.resolve({ data: [row], error: null });
        },
        update(payload: Record<string, unknown>) {
          return new DemoMutation(
            table,
            () => tableRows(table),
            payload,
            "update"
          );
        },
        delete() {
          return new DemoMutation(
            table,
            () => tableRows(table),
            null,
            "delete"
          );
        },
      };
    },
    async rpc(
      name: string,
      args: {
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
      }
    ) {
      if (name === "create_order") {
        return {
          data: createDemoOrder({
            restaurant_id: args.v_restaurant_id,
            created_by: args.v_created_by,
            items: args.p_items,
            method: args.v_method,
          }),
          error: null,
        };
      }
      return { data: null, error: { message: `Unknown demo RPC: ${name}` } };
    },
  };
}

export type DemoClient = ReturnType<typeof createDemoClient>;

// Re-export so the server demo path can reuse the same seed data.
export { DEMO_RESTAURANT, DEMO_BUSINESS, getStore };