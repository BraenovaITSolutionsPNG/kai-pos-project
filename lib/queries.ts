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

  // A suspended business can no longer use the platform.
  if (business && business.is_active === false) redirect("/login");

  // Payment approval gates app access: only businesses with an active
  // subscription use the service. Owners are still signed in so they can
  // land on the subscription page and submit their payment proof.
  const subscription = await getMySubscription();
  if (subscription && subscription.status !== "active")
    redirect("/subscription");

  return {
    user: profile as unknown as UserProfile,
    staff: staff as unknown as Staff,
    restaurant: restaurant as unknown as Restaurant,
    business: (business ?? null) as unknown as Business,
  };
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
      .select("*, order_items(*), payments(*)")
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

export const getShifts = cache(async (): Promise<Shift[]> => {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("shifts")
    .select("*")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("clock_in", { ascending: false });

  return (data as unknown as Shift[]) ?? [];
});

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
  const { data } = await authGetUser();
  if (!data.user || !data.user.is_platform_admin) redirect("/dashboard");
  return data.user;
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