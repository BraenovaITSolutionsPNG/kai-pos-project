# KAI POS — Build Plan for OpenCode

**A restaurant management platform for Papua New Guinea**
Prepared by Amuna IT Solutions

---

## 1. Product Summary

KAI POS is a subscription-based, cloud-connected restaurant operating system for the PNG market. It starts as a POS + Orders system and grows into a full platform: tables, kitchen display, inventory/recipes, staff roles, cashup, analytics, and eventually online ordering, delivery, reservations, loyalty, and multi-branch management.

Revenue model: monthly SaaS plans (Starter / Business / Professional) + one-time setup & training fee, billed in PGK.

---

## 2. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14+ (App Router) + TypeScript** | Single codebase for web + PWA, server actions, API routes, SSR for dashboards |
| Database | **Supabase (PostgreSQL)** | Managed Postgres, instant REST/GraphQL, Row Level Security fits multi-tenant model well |
| Auth | **Supabase Auth** | Email/password + magic link; roles stored in `users`/`staff` tables, enforced via RLS |
| Realtime | **Supabase Realtime** | Powers Kitchen Display System (order status pushes) and table status updates |
| Storage | **Supabase Storage** | Product images, logos, receipt PDFs |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent, matches the dashboard reference designs (cards, sidebars, charts) |
| Charts | **Recharts** | Sales trend lines, bar charts, donut charts (matches "Sales Overview" reference) |
| PWA | **next-pwa** or manual service worker | Installable on tablet/phone/PC, works like a native POS terminal |
| Offline (Phase 7) | **IndexedDB (Dexie.js) + background sync** | Local order queue during internet outages, syncs to Supabase when back online |
| Printing | **Web Bluetooth / ESC-POS via browser print or thermal printer SDK** | Receipt printing from tablet/PC |
| Hosting | **Vercel** (app) + **Supabase Cloud** (DB/Auth/Storage) | Zero-ops, scales per restaurant tenant |
| Payments (future) | Local PNG gateway integration (BSP, Kina Bank APIs) when available | Currently payment *methods* are logged, not processed online |

**Multi-tenancy approach:** every table has a `restaurant_id` (or `business_id`) column. Supabase RLS policies scope every query to the logged-in user's restaurant(s). This lets one platform run hundreds of restaurants safely.

---

## 3. Database Schema (Supabase / Postgres)

```
businesses
  id, name, owner_id, plan (starter|business|professional), created_at

restaurants
  id, business_id, name, address, currency (default 'PGK'), logo_url, created_at

users
  id (uuid, matches auth.users), email, full_name, phone, created_at

staff
  id, restaurant_id, user_id, role (owner|manager|cashier|kitchen), is_active, created_at

roles              -- optional lookup table if you want configurable permissions
  id, name, permissions (jsonb)

categories
  id, restaurant_id, name, sort_order

products
  id, restaurant_id, category_id, name, price, image_url, is_active, sort_order

ingredients
  id, restaurant_id, name, unit (g|ml|kg|l|unit), current_stock, reorder_level

recipes
  id, product_id, ingredient_id, quantity_required

inventory_transactions
  id, restaurant_id, ingredient_id, type (restock|sale_deduction|adjustment|waste),
  quantity, reference_order_id, created_by, created_at

tables
  id, restaurant_id, label (T01), status (available|occupied|reserved), capacity, position_x, position_y

orders
  id, restaurant_id, table_id (nullable for takeaway), order_number, status
  (open|sent_to_kitchen|preparing|ready|served|paid|cancelled),
  subtotal, tax, total, created_by, created_at, updated_at

order_items
  id, order_id, product_id, quantity, unit_price, notes, status (new|preparing|ready)

kitchen_orders
  id, order_id, restaurant_id, status (new|preparing|ready|served), accepted_at, ready_at

payments
  id, order_id, method (cash|eftpos|bank_transfer|bsp|kina_bank|anz|westpac|other),
  amount, reference, created_at

customers
  id, restaurant_id, name, phone, email, loyalty_points (future)

expenses
  id, restaurant_id, category, amount, note, created_by, created_at

shifts
  id, restaurant_id, staff_id, clock_in, clock_out

cashups
  id, restaurant_id, shift_id, cash_total, eftpos_total, bank_transfer_total,
  refunds, expenses, net_sales, closed_by, closed_at

subscriptions
  id, business_id, plan, status (active|past_due|cancelled), renewal_date, price
```

**Row Level Security pattern:**
```sql
create policy "restaurant isolation"
on orders for select
using (
  restaurant_id in (
    select restaurant_id from staff where user_id = auth.uid() and is_active = true
  )
);
```
Apply equivalent policies to every restaurant-scoped table.

---

## 4. Phased Build Order

| Phase | Scope |
|---|---|
| **1** | Auth, restaurant setup wizard, Products & Categories CRUD, POS/Sales screen, Orders, Payments (cash/EFTPOS/bank transfer logged), receipt printing |
| **2** | Table Management (floor plan grid with status), Kitchen Display System (realtime order pipeline: New → Preparing → Ready), cashier "order ready" notification |
| **3** | Ingredients, Recipes, automatic stock deduction on sale, low-stock alerts |
| **4** | Reports (daily/weekly/monthly sales, top products, payment method split), Daily Cashup workflow |
| **5** | Staff accounts & role-based permissions (Owner / Manager / Cashier / Kitchen), shift clock-in/out |
| **6** | Subscription billing tiers, Super Admin panel (manage all businesses, plans, renewals) |
| **7** | Offline mode (IndexedDB queue + sync), hardware integration (thermal printers, barcode scanners) |
| **Future** | Online ordering, delivery/driver management, table reservations, loyalty points, QR menu, accounting exports, multi-branch owner dashboard |

Build and ship Phase 1 as a working demo before adding later phases — this gives Amuna IT something sellable early.

---

## 5. Core App Structure (Next.js App Router)

```
app/
  (auth)/login/page.tsx
  (auth)/signup/page.tsx
  (dashboard)/
    layout.tsx                -- sidebar + topbar shell (see design notes below)
    dashboard/page.tsx        -- owner/manager overview
    pos/page.tsx              -- cashier sales screen
    tables/page.tsx           -- floor plan
    kitchen/page.tsx          -- KDS board
    products/page.tsx
    categories/page.tsx
    inventory/page.tsx
    recipes/page.tsx
    orders/page.tsx
    reports/page.tsx
    cashup/page.tsx
    staff/page.tsx
    settings/page.tsx
  api/
    orders/route.ts
    kitchen/route.ts
    cashup/route.ts
lib/
  supabase/client.ts
  supabase/server.ts
  types.ts
components/
  pos/ProductGrid.tsx, Cart.tsx, PaymentModal.tsx
  tables/TableGrid.tsx, TableCard.tsx
  kitchen/OrderTicket.tsx, KitchenBoard.tsx
  dashboard/StatCard.tsx, SalesChart.tsx, TopProducts.tsx
  ui/ (shadcn components)
```

### Design direction (based on reference dashboards)
- Left sidebar navigation (Dashboard, POS, Tables, Orders, Kitchen, Products, Inventory, Reports, Staff, Settings), collapsible for tablet use.
- Top stat cards row (Today's Sales, Orders, Avg Order Value, Best Seller, Low Stock).
- Sales trend line chart + orders bar chart side by side.
- Table Management as a colour-coded grid (green = available, red = occupied, yellow = reserved) with occupancy counts, matching the floor-plan reference image.
- Kitchen Display as a Kanban-style board: New → Preparing → Ready columns, big touch-friendly cards.
- POS screen: large category tabs across top, big product buttons in a grid (touch-optimized), running cart on the right with subtotal/tax/total and payment method buttons.
- Keep it light-themed for POS/dashboard by default; dark-themed variant can be offered as a setting later (as shown in one reference).

---

## 6. PNG-Specific Requirements

- Currency: PGK (Kina) formatting everywhere, `K` prefix.
- Payment methods: Cash, EFTPOS, Bank Transfer, BSP, Kina Bank, ANZ, Westpac, Other.
- Receipts: business name, order number, date (DD/MM/YYYY), line items, total, payment method, "Thank you" footer — printable to thermal printer or PDF.
- Tax field present but configurable (many small PNG restaurants are not GST-registered; make tax rate a per-restaurant setting, default 0%).

---

## 7. Pricing Tiers (for reference inside the app's subscription settings)

| Plan | Price | Includes |
|---|---|---|
| Starter | K500/month or K5000/year | POS, Products, Orders, daily dashboard, 2 staff accounts |
| Business | K1500/month or K15000/year | + Tables, Kitchen Display, Inventory & recipes, Reports & expenses, 5 staff accounts |
| Professional | K2500/month or K25000/year | + Unlimited staff, priority support, dedicated onboarding & training |
| Setup & Training | K300–K800 one-time | Installation, menu entry, printer config, staff training |

Annual plans are billed once a year and include 2 months free.

---

## 8. Master OpenCode Prompt (paste this into OpenCode to scaffold Phase 1)

```
Build "KAI POS" — a multi-tenant restaurant POS web app.

Stack: Next.js 14 App Router + TypeScript, Supabase (Postgres/Auth/Realtime/Storage),
Tailwind CSS + shadcn/ui, Recharts, PWA-enabled.

Set up:
1. Supabase schema for: businesses, restaurants, users, staff, categories, products,
   orders, order_items, payments, tables (see attached schema doc). Add RLS policies
   scoping all restaurant-owned tables to staff.restaurant_id via auth.uid().
2. Auth pages (login/signup) using Supabase Auth, redirecting to /dashboard.
3. Dashboard shell: collapsible left sidebar (Dashboard, POS, Tables, Orders, Kitchen,
   Products, Reports, Settings), top bar with logged-in user.
4. /pos page: category tabs, large product-button grid, running cart panel with
   subtotal/tax/total, payment method selection (Cash, EFTPOS, Bank Transfer, BSP,
   Kina Bank, ANZ, Westpac, Other), and a "Print Receipt" action that renders a
   receipt formatted in PGK with business name, order #, date, items, total.
5. /products and /categories pages: CRUD tables with add/edit/delete using
   shadcn Dialog + Table components.
6. /orders page: list of orders with status and totals, filterable by date.
7. /dashboard page: stat cards (Today's Sales, Orders, Avg Order Value, Best Seller,
   Low Stock placeholder) + Recharts line chart (sales trend) + bar chart (orders by day).
8. Make it PWA-installable and mobile/tablet responsive first.
9. Use PGK currency formatting (K prefix) throughout.

Do not build Tables, Kitchen Display, Inventory, Staff roles, or Cashup yet —
those are later phases. Focus only on the above for this build.
```

Use this as Phase 1's prompt, then create a follow-up prompt per phase (2–7) referencing the schema sections above once Phase 1 is working.

---

## 9. Suggested Next Steps

1. Create the Supabase project and run the Phase 1 schema (businesses → payments).
2. Run the OpenCode master prompt above to scaffold the Phase 1 app.
3. Connect Amuna IT's own test restaurant as the first tenant to dogfood the POS.
4. Once Phase 1 is stable, demo it to a pilot restaurant client (e.g. one of the existing Port Moresby prospects) before building Phase 2.
