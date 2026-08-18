"use client";

import type { PaymentMethod } from "@/lib/types";
import type { DbQueryPlan } from "@/lib/mysql/types";

// Browser-side client that mirrors the Supabase query API but sends
// operations to the /api/db route, which runs them against MySQL.

type Result = { data: unknown; error: { message: string } | null };

async function post(body: unknown): Promise<Result> {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Result;
  if (!res.ok) {
    return { data: null, error: json.error ?? { message: "Request failed" } };
  }
  return json;
}

class MysqlBrowserQuery {
  private filters: { field: string; op: string; value: unknown }[] = [];
  private orderBy: { col: string; asc: boolean }[] = [];
  private singleFlag = false;

  constructor(
    private table: string,
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
  gt(field: string, value: unknown) {
    this.filters.push({ field, op: "gt", value });
    return this;
  }
  lt(field: string, value: unknown) {
    this.filters.push({ field, op: "lt", value });
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
  limit(n: number) {
    const plan: DbQueryPlan = {
      table: this.table,
      select: this.selectCols,
      filters: this.filters as never,
      order: this.orderBy as never,
      limit: n,
    };
    return post({ op: "select", plan }).then((r) => r.data);
  }
  single() {
    this.singleFlag = true;
    return post({ op: "select", plan: this.toPlan() });
  }
  maybeSingle() {
    this.singleFlag = true;
    return post({ op: "select", plan: this.toPlan() });
  }
  then(
    resolve: (value: Result) => void,
    reject?: (reason?: unknown) => void
  ) {
    return post({ op: "select", plan: this.toPlan() }).then(resolve, reject);
  }

  private toPlan(): DbQueryPlan {
    return {
      table: this.table,
      select: this.selectCols,
      filters: this.filters as never,
      order: this.orderBy as never,
      single: this.singleFlag,
    };
  }
}

class MysqlBrowserMutation {
  private filters: { field: string; op: string; value: unknown }[] = [];

  constructor(
    private table: string,
    private payload: Record<string, unknown> | null,
    private mode: "update" | "delete"
  ) {}

  eq(field: string, value: unknown) {
    this.filters.push({ field, op: "eq", value });
    return this;
  }

  single() {
    return this.run();
  }
  then(resolve: (value: Result) => void, reject?: (reason?: unknown) => void) {
    return this.run().then(resolve, reject);
  }

  private run(): Promise<Result> {
    if (this.mode === "update") {
      return post({
        op: "update",
        table: this.table,
        payload: this.payload,
        filters: this.filters,
      });
    }
    return post({
      op: "delete",
      table: this.table,
      filters: this.filters,
    });
  }
}

export function createMysqlBrowserClient() {
  return {
    from(table: string) {
      return {
        select(cols = "*") {
          return new MysqlBrowserQuery(table, cols);
        },
        insert(value: Record<string, unknown>) {
          return post({ op: "insert", table, payload: value });
        },
        update(payload: Record<string, unknown>) {
          return new MysqlBrowserMutation(table, payload, "update");
        },
        delete() {
          return new MysqlBrowserMutation(table, null, "delete");
        },
      };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      return post({ op: "rpc", name, args });
    },
    auth: {
      async getUser() {
        return { data: { user: null }, error: null };
      },
    },
  };
}