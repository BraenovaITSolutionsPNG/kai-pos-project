import "server-only";

import {
  execCreateOrder,
  execDelete,
  execInsert,
  execSelect,
  execUpdate,
  authGetUser,
  authSignInWithPassword,
  authSignUp,
  authSignOut,
  type DbFilter,
  type DbOrder,
  type DbQueryPlan,
} from "@/lib/mysql/executor";

class MysqlQuery {
  private filters: DbFilter[] = [];
  private orderBy: DbOrder[] = [];
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
      filters: this.filters,
      order: this.orderBy,
      limit: n,
    };
    return execSelect(plan).then((r) => r.data);
  }
  single() {
    this.singleFlag = true;
    return execSelect(this.toPlan());
  }
  maybeSingle() {
    this.singleFlag = true;
    return execSelect(this.toPlan());
  }
  then(
    resolve: (value: { data: unknown; error: null }) => void,
    reject?: (reason?: unknown) => void
  ) {
    return execSelect(this.toPlan()).then(resolve, reject);
  }

  private toPlan(): DbQueryPlan {
    return {
      table: this.table,
      select: this.selectCols,
      filters: this.filters,
      order: this.orderBy,
      single: this.singleFlag,
    };
  }
}

class MysqlMutation {
  private filters: DbFilter[] = [];

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
  then(
    resolve: (value: { data: unknown; error: null }) => void,
    reject?: (reason?: unknown) => void
  ) {
    return this.run().then(resolve, reject);
  }

  private run(): Promise<{ data: unknown; error: null }> {
    if (this.mode === "update" && this.payload) {
      return execUpdate({
        table: this.table,
        payload: this.payload,
        filters: this.filters,
      });
    }
    return execDelete({ table: this.table, filters: this.filters });
  }
}

export function createMysqlServerClient() {
  const auth = {
    async getUser() {
      return authGetUser();
    },
    async signInWithPassword(args: { email: string; password: string }) {
      return authSignInWithPassword(args);
    },
    async signUp(args: {
      email: string;
      password: string;
      options?: { data?: Record<string, string> };
    }) {
      return authSignUp(args);
    },
    async signOut() {
      return authSignOut();
    },
  };

  return {
    auth,
    from(table: string) {
      return {
        select(cols = "*") {
          return new MysqlQuery(table, cols);
        },
        insert(value: Record<string, unknown>) {
          return execInsert({ table, payload: value });
        },
        update(payload: Record<string, unknown>) {
          return new MysqlMutation(table, payload, "update");
        },
        delete() {
          return new MysqlMutation(table, null, "delete");
        },
      };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "create_order") {
        return execCreateOrder(args as never);
      }
      return { data: null, error: { message: `Unknown RPC: ${name}` } };
    },
  };
}