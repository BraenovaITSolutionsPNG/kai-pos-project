import type { Category, Product } from "@/lib/types";

export const DEMO_RESTAURANT = {
  id: "demo-restaurant",
  business_id: "demo-business",
  name: "KAI Demo Café",
  address: "Waigani Drive, Port Moresby",
  currency: "PGK",
  logo_url: null,
  tax_rate: 0,
  created_at: new Date().toISOString(),
};

export const DEMO_BUSINESS = {
  id: "demo-business",
  name: "KAI Demo Café",
  owner_id: "demo-user",
  plan: "starter",
  created_at: new Date().toISOString(),
};

const NOW = Date.now();
const HOUR = 3600_000;

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

export function demoCategories(): Category[] {
  return [
    { id: "c-food", restaurant_id: DEMO_RESTAURANT.id, name: "Food", sort_order: 1, created_at: iso(-7 * 24 * HOUR) },
    { id: "c-drinks", restaurant_id: DEMO_RESTAURANT.id, name: "Drinks", sort_order: 2, created_at: iso(-7 * 24 * HOUR) },
    { id: "c-snacks", restaurant_id: DEMO_RESTAURANT.id, name: "Snacks", sort_order: 3, created_at: iso(-7 * 24 * HOUR) },
    { id: "c-desserts", restaurant_id: DEMO_RESTAURANT.id, name: "Desserts", sort_order: 4, created_at: iso(-7 * 24 * HOUR) },
  ];
}

export function demoProducts(): Product[] {
  const cat = (id: string) => id;
  return [
    { id: "p-1", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-food"), name: "Chicken Fried Rice", price: 25, image_url: null, ingredients: "Chicken, rice, vegetables, soy sauce", prep_time: 15, is_active: true, sort_order: 1, created_at: iso(-6 * 24 * HOUR) },
    { id: "p-2", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-food"), name: "Fish & Chips", price: 32, image_url: null, ingredients: "Fish fillet, potatoes, batter", prep_time: 20, is_active: true, sort_order: 2, created_at: iso(-6 * 24 * HOUR) },
    { id: "p-3", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-food"), name: "Chicken Steak", price: 38, image_url: null, ingredients: "Chicken breast, pepper sauce, vegetables", prep_time: 25, is_active: true, sort_order: 3, created_at: iso(-6 * 24 * HOUR) },
    { id: "p-4", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-food"), name: "BBQ Pork Ribs", price: 42, image_url: null, ingredients: "Pork ribs, BBQ sauce, coleslaw", prep_time: 30, is_active: true, sort_order: 4, created_at: iso(-6 * 24 * HOUR) },
    { id: "p-5", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-drinks"), name: "Coca-Cola (330ml)", price: 5.5, image_url: null, ingredients: null, prep_time: 0, is_active: true, sort_order: 1, created_at: iso(-6 * 24 * HOUR) },
    { id: "p-6", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-drinks"), name: "Fresh Water (1.5L)", price: 5, image_url: null, ingredients: null, prep_time: 0, is_active: true, sort_order: 2, created_at: iso(-6 * 24 * HOUR) },
    { id: "p-7", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-drinks"), name: "Mango Juice", price: 8, image_url: null, ingredients: "Fresh mango, water, sugar", prep_time: 5, is_active: true, sort_order: 3, created_at: iso(-6 * 24 * HOUR) },
    { id: "p-8", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-snacks"), name: "Crisps", price: 4, image_url: null, ingredients: null, prep_time: 0, is_active: true, sort_order: 1, created_at: iso(-6 * 24 * HOUR) },
    { id: "p-9", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-snacks"), name: "Chicken Roll", price: 12, image_url: null, ingredients: "Chicken, wrap, lettuce, mayo", prep_time: 10, is_active: true, sort_order: 2, created_at: iso(-6 * 24 * HOUR) },
    { id: "p-10", restaurant_id: DEMO_RESTAURANT.id, category_id: cat("c-desserts"), name: "Ice Cream Sundae", price: 8, image_url: null, ingredients: "Vanilla ice cream, chocolate sauce, nuts", prep_time: 5, is_active: true, sort_order: 1, created_at: iso(-6 * 24 * HOUR) },
  ];
}

// Deterministic pseudo-random so the demo charts look stable within a run.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const METHODS = ["cash", "eftpos", "bsp", "bank_transfer", "cash", "kina_bank", "cash"];

export function demoOrders(): Record<string, unknown>[] {
  const rand = mulberry32(20260501);
  const products = demoProducts();
  const orders: Record<string, unknown>[] = [];
  let number = 1;

  const pick = () => products[Math.floor(rand() * products.length)];

  for (let day = 6; day >= 0; day--) {
    const perDay = 3 + Math.floor(rand() * 4); // 3-6 orders/day
    for (let i = 0; i < perDay; i++) {
      const itemCount = 1 + Math.floor(rand() * 4);
      const items = Array.from({ length: itemCount }, () => pick());
      const created = new Date(NOW - day * 24 * HOUR - Math.floor(rand() * 12) * HOUR);
      const subtotal = items.reduce(
        (sum, p) => sum + Number(p.price),
        0
      );
      const totals: Record<string, unknown>[] = items.map((p) => ({
        id: `oi-${number}-${p.id}`,
        order_id: `o-${number}`,
        product_id: p.id,
        product_name: p.name,
        quantity: 1,
        unit_price: Number(p.price),
        notes: null,
        status: "paid",
        created_at: created.toISOString(),
      }));
      orders.push({
        id: `o-${number}`,
        restaurant_id: DEMO_RESTAURANT.id,
        table_id: null,
        order_number: number,
        status: "paid",
        subtotal: subtotal,
        tax: 0,
        total: subtotal,
        created_by: "demo-user",
        created_at: created.toISOString(),
        updated_at: created.toISOString(),
        order_items: totals,
        payments: [
          {
            id: `pay-${number}`,
            order_id: `o-${number}`,
            method: METHODS[Math.floor(rand() * METHODS.length)],
            amount: subtotal,
            reference: null,
            created_at: created.toISOString(),
          },
        ],
      });
      number++;
    }
  }
  return orders;
}