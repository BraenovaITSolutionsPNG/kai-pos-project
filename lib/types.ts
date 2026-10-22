export type PaymentMethod =
  | "cash"
  | "eftpos"
  | "bank_transfer"
  | "bsp"
  | "kina_bank"
  | "anz"
  | "westpac"
  | "other";

export type OrderStatus =
  | "open"
  | "sent_to_kitchen"
  | "preparing"
  | "ready"
  | "served"
  | "paid"
  | "cancelled";

export type StaffRole = "owner" | "manager" | "cashier" | "kitchen" | "waiter";

export interface Business {
  id: string;
  name: string;
  owner_id: string | null;
  plan: "starter" | "business" | "professional";
  is_active: boolean;
  created_at: string;
}

export interface Restaurant {
  id: string;
  business_id: string;
  name: string;
  address: string | null;
  currency: string;
  logo_url: string | null;
  tax_rate: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_platform_admin: boolean;
  created_at: string;
}

export interface Staff {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  price: number;
  image_url: string | null;
  ingredients: string | null;
  prep_time: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  category_name?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  status: "new" | "preparing" | "ready";
  created_at: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  order_number: number;
  status: OrderStatus;
  order_type: "dine_in" | "takeaway";
  source: "pos" | "self_service";
  subtotal: number;
  tax: number;
  total: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  payments?: Payment[];
  tables?: { label: string | null } | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_notes?: string | null;
  estimated_ready_at?: string | null;
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export type TableStatus = "available" | "occupied" | "reserved";

export interface DiningTable {
  id: string;
  restaurant_id: string;
  label: string;
  status: TableStatus;
  capacity: number;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface Ingredient {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  current_stock: number;
  reorder_level: number;
  created_at: string;
}

export interface Recipe {
  id: string;
  restaurant_id: string;
  product_id: string;
  ingredient_id: string;
  quantity_required: number;
  created_at: string;
  ingredient_name?: string;
}

export interface InventoryTransaction {
  id: string;
  restaurant_id: string;
  ingredient_id: string;
  type: "restock" | "sale_deduction" | "adjustment" | "waste";
  quantity: number;
  reference_order_id: string | null;
  reference: string | null;
  created_by: string | null;
  created_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  restaurant_id: string;
  customer_id: string;
  order_id: string | null;
  type: "earned" | "redeemed" | "expired" | "adjusted" | "bonus";
  points: number;
  balance_after: number;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  restaurant_id: string;
  category: string;
  amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Shift {
  id: string;
  restaurant_id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  scheduled_shift_id: string | null;
  created_at: string;
  staff?: { full_name: string; role: string } | null;
}

export interface Cashup {
  id: string;
  restaurant_id: string;
  shift_id: string | null;
  cash_total: number;
  eftpos_total: number;
  bank_transfer_total: number;
  refunds: number;
  expenses: number;
  net_sales: number;
  closed_by: string | null;
  closed_at: string;
}

export interface Customer {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyalty_points: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface SiteContent {
  id: string;
  key: string;
  value: Record<string, unknown> | null;
  created_at: string;
}