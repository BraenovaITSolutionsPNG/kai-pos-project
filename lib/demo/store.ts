"use client";

import type { PaymentMethod } from "@/lib/types";
import {
  DEMO_RESTAURANT,
  demoCategories,
  demoOrders,
  demoProducts,
} from "@/lib/demo/seed";

const STORAGE_KEY = "kai_pos_demo_store";
const STORE_VERSION = 3;

export interface DemoRow {
  id: string;
  [key: string]: unknown;
  order_items?: DemoRow[];
  payments?: DemoRow[];
  category_name?: string | null;
}

export interface DemoStoreState {
  version: number;
  restaurant: DemoRow;
  categories: DemoRow[];
  products: DemoRow[];
  orders: DemoRow[];
}

function isEmptyState(s: DemoStoreState | null): boolean {
  return !s || s.version !== STORE_VERSION;
}

export function getStore(): DemoStoreState {
  if (typeof window === "undefined") {
    throw new Error("Demo store is only available in the browser.");
  }
  let state: DemoStoreState | null = null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = raw ? (JSON.parse(raw) as DemoStoreState) : null;
  } catch {
    state = null;
  }
  if (isEmptyState(state)) {
    const freshState: DemoStoreState = {
      version: STORE_VERSION,
      restaurant: { ...DEMO_RESTAURANT, created_at: new Date().toISOString() },
      categories: demoCategories() as unknown as DemoRow[],
      products: demoProducts() as unknown as DemoRow[],
      orders: demoOrders() as unknown as DemoRow[],
    };
    saveState(freshState);
    return freshState;
  }
  return state as DemoStoreState;
}

function saveState(state: DemoStoreState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function saveTable(table: string, rows: DemoRow[]): void {
  const state = getStore();
  if (table === "restaurant" || table === "restaurants") {
    state.restaurant = rows[0] ?? state.restaurant;
  } else {
    (state[table as keyof DemoStoreState] as DemoRow[]) = rows;
  }
  saveState(state);
}

export function resetDemo(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function tableRows(table: string): DemoRow[] {
  if (table === "restaurants") {
    return [getStore().restaurant];
  }
  return getStore()[table as keyof DemoStoreState] as DemoRow[];
}

export function createDemoOrder(args: {
  restaurant_id: string;
  created_by: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
  }[];
  method: PaymentMethod;
}): DemoRow {
  const state = getStore();
  const restaurant = state.restaurant;
  const taxRate = Number(restaurant.tax_rate ?? 0);

  const items = args.items.map((i) => ({
    product_id: i.product_id,
    product_name: i.product_name,
    quantity: i.quantity,
    unit_price: Number(i.unit_price),
    notes: i.notes ?? null,
  }));

  const subtotal = items.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0);
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const maxNumber = state.orders.reduce(
    (max, o) => Math.max(max, Number(o.order_number ?? 0)),
    0
  );
  const orderNumber = maxNumber + 1;
  const now = new Date();

  const order: DemoRow = {
    id: `o-demo-${orderNumber}`,
    restaurant_id: args.restaurant_id,
    table_id: null,
    order_number: orderNumber,
    status: "paid",
    subtotal,
    tax,
    total,
    created_by: args.created_by,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    order_items: items.map((i, idx) => ({
      id: `od-${orderNumber}-${idx}`,
      order_id: `o-demo-${orderNumber}`,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      notes: i.notes,
      status: "paid",
      created_at: now.toISOString(),
    })),
    payments: [
      {
        id: `op-${orderNumber}`,
        order_id: `o-demo-${orderNumber}`,
        method: args.method,
        amount: total,
        reference: null,
        created_at: now.toISOString(),
      },
    ],
  };

  state.orders.push(order);
  saveState(state);
  return order;
}