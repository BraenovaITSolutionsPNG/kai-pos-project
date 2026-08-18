# KAI POS

**Restaurant management platform for Papua New Guinea** — built by [Amuna IT Solutions].

Phase 1 covers: authentication, restaurant auto-provisioning, Products & Categories CRUD, the POS/sales screen with cart & payments (Cash / EFTPOS / Bank Transfer / BSP / Kina Bank / ANZ / Westpac / Other), receipt printing, an orders list, a sales dashboard, and PWA install support. All money is formatted in **PGK (Kina, `K` prefix)**.

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Supabase (Postgres, Auth, RLS)
- Tailwind CSS v4 + shadcn/ui
- Recharts
- PWA (service worker + web app manifest)

## Getting started

### Try it instantly (demo mode)

No database or Supabase account needed — the whole app runs in the browser with a pre-seeded sample café. Every change is saved to `localStorage`.

1. Copy the template and enable demo mode:

   ```bash
   cp .env.example .env.local
   ```

   ```
   NEXT_PUBLIC_DEMO_MODE=true
   ```

2. Run it:

   ```bash
   npm install
   npm run dev        # http://localhost:3000
   ```

3. Sign up with any email + password. You'll land straight in the demo café — ring up sales on **POS**, edit the menu, and watch the **Dashboard** update. A **Demo** badge appears in the header, and **Settings → Reset demo data** restores the original sample data.

> Demo mode works without any Supabase credentials. As soon as you provide `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and set `NEXT_PUBLIC_DEMO_MODE` to anything other than `true`), the app switches to the real database.

### With a Supabase database

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run the file `supabase/schema.sql`. It creates all Phase 1 tables, Row Level Security policies, a sign-up trigger that auto-creates each tenant's business + restaurant + owner staff + a starter menu, and the `create_order` RPC.
3. Get your project **URL** and **anon key** from Project Settings → API.
4. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

5. (Recommended for a frictionless demo) In Supabase → Authentication → Providers → Email, turn **off "Confirm email"** so sign-ups are immediately active.
6. Run it:

   ```bash
   npm install
   npm run dev        # http://localhost:3000
   ```

7. Sign up with your name + business name. Your first cafe, a starter menu and an owner account are created automatically — go straight to **POS**.

> The app redirects unauthenticated visitors to `/login` and blocks access to dashboard routes until you add your Supabase credentials (or enable demo mode).

## Routes

| Route | Purpose |
|---|---|
| `/login`, `/signup` | Auth with Supabase (email + password) |
| `/dashboard` | Today's sales, avg order value, 7-day sales trend + orders chart, top products, payment split |
| `/pos` | Touch-optimised sales screen: category tabs, product grid, cart, payment methods, printable PGK receipt |
| `/orders` | Order history with status and totals, filterable by date |
| `/products` | Menu item CRUD (name, Kina price, category, active) |
| `/categories` | Menu category tabs CRUD |
| `/settings` | Restaurant name/address and configurable GST rate (default 0%) |

## Database

Multi-tenant by design — every restaurant-scoped row carries `restaurant_id`, and Supabase RLS policies scope every query to the staff rows of the signed-in user. The schema (tables `businesses` → `payments`) is documented in `supabase/schema.sql`.

### Phase 1 data model

```
businesses → restaurants → staff  (users = auth.users)
categories → products
orders → order_items, payments
tables (provisioned for Phase 2)
```

Orders are created with the `create_order(v_restaurant_id, v_created_by, p_items jsonb, v_method)` RPC, which computes subtotal/GST/total, issues the next daily order number, and writes the payment in one transaction.

## Phase roadmap

- **Done (Phase 1):** Auth, tenant setup, Products/Categories, POS, payments, receipts, orders, dashboard, PGK formatting, PWA.
- **Next:** Tables/floor plan, Kitchen Display System (real-time), inventory & recipes, cashup, staff roles, subscriptions.
- **Future:** Online ordering, delivery, reservations, loyalty, QR menus, multi-branch.

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
```