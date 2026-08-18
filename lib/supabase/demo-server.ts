import { cookies } from "next/headers";
import {
  DEMO_BUSINESS,
  DEMO_RESTAURANT,
  demoCategories,
  demoOrders,
  demoProducts,
} from "@/lib/demo/seed";

export async function createDemoServerClient() {
  const cookieStore = await cookies();

  const readSession = () => {
    const raw = cookieStore.get("demo_session")?.value;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return null;
    }
  };

  const writeSession = (value: Record<string, string>) => {
    cookieStore.set("demo_session", JSON.stringify(value), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  };

  const auth = {
    async getUser() {
      const user = readSession();
      return user
        ? { data: { user }, error: null }
        : { data: { user: null }, error: null };
    },
    async signUp({
      email,
      options,
    }: {
      email: string;
      options?: { data?: Record<string, string> };
    }) {
      const fullName = options?.data?.full_name ?? email;
      writeSession({ id: "demo-user", email, full_name: fullName, role: "owner" });
      return { data: { user: { id: "demo-user", email, full_name: fullName }, session: {} }, error: null };
    },
    async signInWithPassword({ email }: { email: string }) {
      const fullName =
        email
          .replace(/@.*/, "")
          .replace(/[^a-z0-9]/gi, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Demo User";
      writeSession({ id: "demo-user", email, full_name: fullName, role: "owner" });
      return { data: { user: { id: "demo-user", email, full_name: fullName }, session: {} }, error: null };
    },
    async signOut() {
      cookieStore.delete("demo_session");
      return { error: null };
    },
  };

  const tables: Record<string, () => Record<string, unknown>[]> = {
    users: () => [
      {
        id: "demo-user",
        email: readSession()?.email ?? "demo@restaurant.pg",
        full_name: readSession()?.full_name ?? "Demo Owner",
        phone: null,
        created_at: new Date().toISOString(),
      },
    ],
    staff: () => [
      {
        id: "staff-demo",
        restaurant_id: DEMO_RESTAURANT.id,
        user_id: "demo-user",
        role: "owner",
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    restaurants: () => [DEMO_RESTAURANT],
    businesses: () => [DEMO_BUSINESS],
    categories: () =>
      demoCategories() as unknown as Record<string, unknown>[],
    products: () => demoProducts() as unknown as Record<string, unknown>[],
    orders: () => demoOrders() as Record<string, unknown>[],
    order_items: () =>
      demoOrders().flatMap((o) => o.order_items as unknown[]) as Record<
        string,
        unknown
      >[],
    payments: () =>
      demoOrders().flatMap((o) => o.payments as unknown[]) as Record<
        string,
        unknown
      >[],
  };

  function rowsFor(table: string): Record<string, unknown>[] {
    const fn = tables[table];
    return fn ? (fn() as Record<string, unknown>[]) : [];
  }

  const query = (table: string, selectCols: string) => {
    let filterData = rowsFor(table);

    const apply = (filters: { k: string; op: string; v: unknown }[]) => {
      return filterData.filter((r) =>
        filters.every((f) => {
          const v = (r as Record<string, unknown>)[f.k];
          switch (f.op) {
            case "eq":
              return v === f.v;
            case "g.":
              return Number(v) >= Number(f.v);
            case "l.":
              return Number(v) <= Number(f.v);
            case "n.":
              return v !== f.v;
            default:
              return true;
          }
        })
      );
    };

    return {
      filters: [] as { k: string; op: string; v: unknown }[],
      eq(k: string, v: unknown) {
        this.filters.push({ k, op: "eq", v });
        if (k === "id" && table === "users") {
          filterData = rowsFor("users").filter((r) => r.id === v);
        }
        if (k === "user_id" && table === "staff") {
          filterData = rowsFor("staff").filter((r) => r.user_id === v);
        }
        return this;
      },
      gte(k: string, v: unknown) {
        this.filters.push({ k, op: "g.", v });
        return this;
      },
      lte(k: string, v: unknown) {
        this.filters.push({ k, op: "l.", v });
        return this;
      },
      neq(k: string, v: unknown) {
        this.filters.push({ k, op: "n.", v });
        return this;
      },
      in() {
        return this;
      },
      order() {
        // Demo data is pre-sorted; ignore ordering.
        return this;
      },
      single() {
        const [row] = apply(this.filters);
        return Promise.resolve({ data: row ?? null, error: null });
      },
      maybeSingle() {
        const [row] = apply(this.filters);
        return Promise.resolve({ data: row ?? null, error: null });
      },
      async then(resolve: (v: { data: unknown; error: null }) => void) {
        let rows = apply(this.filters);
        if (selectCols.includes("order_items(*)")) {
          rows = rows.map((r) => ({ ...r, order_items: r.order_items ?? [] }));
        }
        if (selectCols.includes("payments(*)")) {
          rows = rows.map((r) => ({ ...r, payments: r.payments ?? [] }));
        }
        if (selectCols.includes("category:categories(name)")) {
          rows = rows.map((r) => ({
            ...r,
            category_name: (r as Record<string, unknown>).category_name ?? null,
          }));
        }
        resolve({ data: rows, error: null });
      },
    };
  };

  return {
    auth,
    from(table: string) {
      return {
        select(cols = "*") {
          return query(table, cols);
        },
      };
    },
  };
}