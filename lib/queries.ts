import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, isDemoMode, isMySqlMode } from "@/lib/supabase/env";
import { computeDashboardStats, type DashboardStats } from "@/lib/stats";
import {
  authGetUser,
  execAdminBusinesses,
  execAdminOverview,
  execAdminSubscriptionPayments,
  execAdminSubscriptions,
  execAdminUsers,
  execGetNotifications,
  execGetMySubscription,
  execGetMyPayments,
  execGetSiteContent,
} from "@/lib/mysql/executor";
import type {
  Business,
  Category,
  DiningTable,
  Expense,
  Ingredient,
  InventoryTransaction,
  Order,
  Product,
  Recipe,
  Restaurant,
  Shift,
  Staff,
  StaffRole,
  UserProfile,
} from "@/lib/types";

export interface SessionContext {
  user: UserProfile;
  staff: Staff;
  restaurant: Restaurant;
  business: Business;
}

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  if (!isDemoMode() && !isMySqlMode() && !isSupabaseConfigured())
    redirect("/login");

  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", authUser.id)
    .eq("is_active", true)
    .order("created_at")
    .maybeSingle();

  if (!staff) {
    // Platform admins run the whole platform, not a single restaurant.
    if ((profile as { is_platform_admin?: boolean } | null)?.is_platform_admin) {
      redirect("/admin");
    }
    // User authenticated but not provisioned to a restaurant yet.
    redirect("/login");
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", staff.restaurant_id)
    .single();

  if (!restaurant) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", restaurant.business_id)
    .single();

  // Inactive businesses (pending first payment, suspended, or lapsed)
  // are handled by the subscription gate below, which routes owners to
  // /subscription so they can pay or resubmit proof.

  // Payment approval gates app access: only businesses with an active
  // subscription use the service. Owners are still signed in so they can
  // land on the subscription page and submit their payment proof.
  const subscription = await getMySubscription();
  // Redirect owners whose subscription is pending approval or has expired
  if (subscription && (subscription.status === "pending" || subscription.status === "expired"))
    redirect("/subscription");

  return {
    user: profile as unknown as UserProfile,
    staff: staff as unknown as Staff,
    restaurant: restaurant as unknown as Restaurant,
    business: (business ?? null) as unknown as Business,
  };
});

export interface RestaurantWithStats {
  id: string;
  name: string;
  address: string;
  currency: string;
  logo_url: string | null;
  created_at: string;
  today_orders: number;
  today_revenue: number;
  active_shifts: number;
}

export const getBusinessRestaurants = cache(async (): Promise<RestaurantWithStats[]> => {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("created_at");

  if (!restaurants || restaurants.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);

  const restaurantIds = (restaurants as unknown as Restaurant[]).map((r) => r.id);

  const [ordersRes, shiftsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("restaurant_id, total, status")
      .in("restaurant_id", restaurantIds)
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`),
    supabase
      .from("shifts")
      .select("restaurant_id, clock_out")
      .in("restaurant_id", restaurantIds)
      .is("clock_out", null),
  ]);

  const ordersByRestaurant = new Map<string, { orders: number; revenue: number }>();
  for (const o of (ordersRes.data ?? []) as unknown as { restaurant_id: string; total: number; status: string }[]) {
    const current = ordersByRestaurant.get(o.restaurant_id) ?? { orders: 0, revenue: 0 };
    current.orders += 1;
    if (o.status === "paid") current.revenue += Number(o.total);
    ordersByRestaurant.set(o.restaurant_id, current);
  }

  const activeShiftsByRestaurant = new Map<string, number>();
  for (const s of (shiftsRes.data ?? []) as unknown as { restaurant_id: string }[]) {
    activeShiftsByRestaurant.set(s.restaurant_id, (activeShiftsByRestaurant.get(s.restaurant_id) ?? 0) + 1);
  }

  return (restaurants as unknown as Restaurant[]).map((r) => ({
    ...r,
    today_orders: ordersByRestaurant.get(r.id)?.orders ?? 0,
    today_revenue: ordersByRestaurant.get(r.id)?.revenue ?? 0,
    active_shifts: activeShiftsByRestaurant.get(r.id) ?? 0,
  }));
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const ctx = await getSessionContext();

  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("sort_order");

  return (data as unknown as Category[]) ?? [];
});

export const getProducts = cache(async (): Promise<Product[]> => {
  const supabase = await createClient();
  const ctx = await getSessionContext();

  const { data } = await supabase
    .from("products")
    .select("*, category:categories(name)")
    .eq("restaurant_id", ctx.restaurant.id)
    .eq("is_active", true)
    .order("sort_order");

  return ((data as unknown as Product[]) ?? []).map((p) => ({
    ...p,
    category_name:
      (p as unknown as { category?: { name: string } | null }).category?.name ??
      null,
  }));
});

export const getAllProducts = cache(async (): Promise<Product[]> => {
  const supabase = await createClient();
  const ctx = await getSessionContext();

  const { data } = await supabase
    .from("products")
    .select("*, category:categories(name)")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("sort_order");

  return ((data as unknown as Product[]) ?? []).map((p) => ({
    ...p,
    category_name:
      (p as unknown as { category?: { name: string } | null }).category?.name ??
      null,
  }));
});

export const getOrders = cache(
  async (from?: string, to?: string): Promise<Order[]> => {
    const ctx = await getSessionContext();
    const supabase = await createClient();

    let query = supabase
      .from("orders")
      .select("*, order_items(*), payments(*), tables(label)")
      .eq("restaurant_id", ctx.restaurant.id)
      .order("created_at", { ascending: false });

    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);

    const { data } = await query;
    return (data as unknown as Order[]) ?? [];
  }
);

export const getDashboardStats = cache(
  async (): Promise<DashboardStats> => {
    const ctx = await getSessionContext();
    const supabase = await createClient();

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const { data: orders } = await supabase
      .from("orders")
      .select("*, order_items(*), payments(*)")
      .eq("restaurant_id", ctx.restaurant.id)
      .gte("created_at", start.toISOString())
      .neq("status", "cancelled");

    return computeDashboardStats((orders ?? []) as unknown as Order[]);
  }
);

export const getTables = cache(async (): Promise<DiningTable[]> => {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("tables")
    .select("*")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("label");

  return (data as unknown as DiningTable[]) ?? [];
});

export const getIngredients = cache(async (): Promise<Ingredient[]> => {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("ingredients")
    .select("*")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("name");

  return (data as unknown as Ingredient[]) ?? [];
});

export const getRecipes = cache(async (): Promise<Recipe[]> => {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("recipes")
    .select("*")
    .eq("restaurant_id", ctx.restaurant.id);

  return (data as unknown as Recipe[]) ?? [];
});

export const getInventoryTransactions = cache(
  async (): Promise<InventoryTransaction[]> => {
    const ctx = await getSessionContext();
    const supabase = await createClient();

    const { data } = await supabase
      .from("inventory_transactions")
      .select("*")
      .eq("restaurant_id", ctx.restaurant.id)
      .order("created_at", { ascending: false })
      .limit(200);

    return (data as unknown as InventoryTransaction[]) ?? [];
  }
);

export const getExpenses = cache(
  async (from?: string, to?: string): Promise<Expense[]> => {
    const ctx = await getSessionContext();
    const supabase = await createClient();

    let query = supabase
      .from("expenses")
      .select("*")
      .eq("restaurant_id", ctx.restaurant.id)
      .order("created_at", { ascending: false });

    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);

    const { data } = await query;
    return (data as unknown as Expense[]) ?? [];
  }
);

export const getKitchenOrders = cache(
  async (): Promise<Order[]> => {
    const ctx = await getSessionContext();
    const supabase = await createClient();

    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*), payments(*)")
      .eq("restaurant_id", ctx.restaurant.id)
      .in("status", [
        "open",
        "sent_to_kitchen",
        "preparing",
        "ready",
        "paid",
      ])
      .order("created_at", { ascending: true });

    return (data as unknown as Order[]) ?? [];
  }
);

export interface ShiftWithStaff extends Shift {
  staff_name: string;
  staff_role: StaffRole;
  cashed_up: boolean;
}

export const getShifts = cache(async (): Promise<ShiftWithStaff[]> => {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("shifts")
    .select("*")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("clock_in", { ascending: false });

  const shifts = (data as unknown as Shift[]) ?? [];
  if (shifts.length === 0) return [];

  const staffIds = [...new Set(shifts.map((s) => s.staff_id))];
  const { data: staffData } = await supabase
    .from("staff")
    .select("id, role, user_id")
    .in("id", staffIds);
  const userIds = [...new Set((staffData ?? []).map((s) => s.user_id))];
  const { data: usersData } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", userIds);
  const userMap = new Map((usersData ?? []).map((u) => [u.id, u.full_name]));
  const staffMap = new Map(
    (staffData ?? []).map((s) => [s.id, { role: s.role, user_id: s.user_id }])
  );

  const { data: cashups } = await supabase
    .from("cashups")
    .select("shift_id")
    .in(
      "shift_id",
      shifts.map((s) => s.id)
    );
  const cashedSet = new Set((cashups ?? []).map((c) => c.shift_id));

  return shifts.map((s) => {
    const st = staffMap.get(s.staff_id);
    return {
      ...s,
      staff_name: (st?.user_id && userMap.get(st.user_id)) || "Unknown",
      staff_role: (st?.role ?? "cashier") as StaffRole,
      cashed_up: cashedSet.has(s.id),
    };
  });
});

export interface StaffOption {
  id: string;
  user_id: string;
  role: StaffRole;
  is_active: boolean;
  name: string;
}

export const getStaffOptions = cache(async (): Promise<StaffOption[]> => {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff")
    .select("id, role, user_id, is_active")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("is_active", { ascending: false });

  const staff = (data ?? []) as Array<{
    id: string;
    role: StaffRole;
    user_id: string;
    is_active: boolean;
  }>;
  if (staff.length === 0) return [];

  const userIds = [...new Set(staff.map((s) => s.user_id))];
  const { data: usersData } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", userIds);
  const userMap = new Map((usersData ?? []).map((u) => [u.id, u.full_name]));

  return staff.map((s) => ({
    id: s.id,
    user_id: s.user_id,
    role: s.role,
    is_active: s.is_active,
    name: userMap.get(s.user_id) || "Unknown",
  }));
});

export interface ShiftScheduleRow {
  id: string;
  restaurant_id: string;
  staff_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  staff_name: string;
  staff_role: StaffRole;
}

export const getShiftSchedules = cache(
  async (): Promise<ShiftScheduleRow[]> => {
    const ctx = await getSessionContext();
    const supabase = await createClient();

    const { data } = await supabase
      .from("shift_schedules")
      .select("*")
      .eq("restaurant_id", ctx.restaurant.id)
      .order("schedule_date", { ascending: true })
      .order("start_time", { ascending: true });

    const scheds = (data ?? []) as Array<{
      id: string;
      restaurant_id: string;
      staff_id: string;
      schedule_date: string;
      start_time: string;
      end_time: string;
      notes: string | null;
    }>;
    if (scheds.length === 0) return [];

    const staffIds = [...new Set(scheds.map((s) => s.staff_id))];
    const { data: staffData } = await supabase
      .from("staff")
      .select("id, role, user_id")
      .in("id", staffIds);
    const userIds = [...new Set((staffData ?? []).map((s) => s.user_id))];
    const { data: usersData } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", userIds);
    const userMap = new Map((usersData ?? []).map((u) => [u.id, u.full_name]));
    const staffMap = new Map(
      (staffData ?? []).map((s) => [s.id, { role: s.role, user_id: s.user_id }])
    );

    return scheds.map((s) => {
      const st = staffMap.get(s.staff_id);
      return {
        ...s,
        staff_name: (st?.user_id && userMap.get(st.user_id)) || "Unknown",
        staff_role: (st?.role ?? "cashier") as StaffRole,
      };
    });
  }
);

// ---------------------------------------------------------------
// Platform administration
// ---------------------------------------------------------------
export interface AdminOverview {
  businesses: number;
  active_businesses: number;
  restaurants: number;
  users: number;
  platform_admins: number;
  staff: number;
  orders: number;
  revenue: number;
}

export interface AdminBusinessRow {
  id: string;
  name: string;
  owner_id: string | null;
  owner_email: string | null;
  plan: "starter" | "business" | "professional";
  is_active: boolean;
  restaurant_count: number;
  created_at: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_platform_admin: boolean;
  memberships: string | null;
  created_at: string;
}

export const requirePlatformAdmin = cache(async () => {
  if (isMySqlMode()) {
    const { data } = await authGetUser();
    if (!data.user || !data.user.is_platform_admin) redirect("/dashboard");
    return data.user;
  }
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();
  if (!profile?.is_platform_admin) redirect("/dashboard");
  return profile;
});

export const getAdminOverview = cache(async (): Promise<AdminOverview> => {
  if (isMySqlMode()) {
    const { data } = await execAdminOverview();
    return data as AdminOverview;
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_admin_overview");
  return (data as unknown as AdminOverview) ?? ({} as AdminOverview);
});

export const getAdminBusinesses = cache(
  async (): Promise<AdminBusinessRow[]> => {
    if (isMySqlMode()) {
      const { data } = await execAdminBusinesses();
      return (data as AdminBusinessRow[]) ?? [];
    }
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_admin_businesses");
    return (data as unknown as AdminBusinessRow[]) ?? [];
  }
);

export const getAdminUsers = cache(async (): Promise<AdminUserRow[]> => {
  if (isMySqlMode()) {
    const { data } = await execAdminUsers();
    return (data as AdminUserRow[]) ?? [];
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_admin_users");
  return (data as unknown as AdminUserRow[]) ?? [];
});

export interface AdminSubscriptionRow {
  id: string;
  business_id: string;
  business_name: string;
  owner_email: string | null;
  plan: "starter" | "business" | "professional";
  billing_cycle: "monthly" | "annual";
  price: number;
  status: "pending" | "active" | "expired" | "cancelled";
  current_period_start: string;
  current_period_end: string;
  reminder_sent_at: string | null;
  pending_payments: number;
  days_left: number;
}

export interface SubscriptionPaymentRow {
  id: string;
  subscription_id: string;
  amount: number;
  method: string;
  bank: string | null;
  reference: string | null;
  proof_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_by_email: string | null;
  created_at: string;
  approved_at: string | null;
}

export const getAdminSubscriptions = cache(
  async (): Promise<AdminSubscriptionRow[]> => {
    if (isMySqlMode()) {
      const { data } = await execAdminSubscriptions();
      return (data as AdminSubscriptionRow[]) ?? [];
    }
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_admin_subscriptions");
    return (data as unknown as AdminSubscriptionRow[]) ?? [];
  }
);

export const getAdminSubscriptionPayments = cache(
  async (subscriptionId: string): Promise<SubscriptionPaymentRow[]> => {
    if (isMySqlMode()) {
      const { data } = await execAdminSubscriptionPayments({
        subscription_id: subscriptionId,
      });
      return (data as SubscriptionPaymentRow[]) ?? [];
    }
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_admin_subscription_payments", {
      p_subscription_id: subscriptionId,
    });
    return (data as unknown as SubscriptionPaymentRow[]) ?? [];
  }
);

export interface NotificationRow {
  id: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const getNotifications = cache(async (): Promise<NotificationRow[]> => {
  if (isMySqlMode()) {
    const { data } = await execGetNotifications();
    return (data as NotificationRow[]) ?? [];
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_notifications");
  return (data as unknown as NotificationRow[]) ?? [];
});

export interface SiteContentRow {
  id: string;
  value: Record<string, unknown> | null;
}

export const getSiteContent = cache(async (): Promise<SiteContentRow[]> => {
  if (isMySqlMode()) {
    const { data } = await execGetSiteContent();
    return (data as SiteContentRow[]) ?? [];
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_site_content");
  return (data as unknown as SiteContentRow[]) ?? [];
});

export interface MySubscriptionRow {
  id: string;
  plan: "starter" | "business" | "professional";
  billing_cycle: "monthly" | "annual";
  price: number;
  status: "pending" | "active" | "expired" | "cancelled";
  current_period_start: string;
  current_period_end: string;
  business_name: string;
}

export const getMySubscription = cache(
  async (): Promise<MySubscriptionRow | null> => {
    if (isMySqlMode()) {
      const { data } = await execGetMySubscription();
      const rows = (data as MySubscriptionRow[]) ?? [];
      return rows[0] ?? null;
    }
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_my_subscription");
    const rows = (data as unknown as MySubscriptionRow[]) ?? [];
    return rows[0] ?? null;
  }
);

export interface MyPaymentRow {
  id: string;
  subscription_id: string;
  amount: number;
  method: string;
  bank: string | null;
  reference: string | null;
  proof_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
}

export const getMyPayments = cache(async (): Promise<MyPaymentRow[]> => {
  if (isMySqlMode()) {
    const { data } = await execGetMyPayments();
    return (data as MyPaymentRow[]) ?? [];
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_payments");
  return (data as unknown as MyPaymentRow[]) ?? [];
});