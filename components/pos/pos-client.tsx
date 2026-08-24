"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Printer,
  UtensilsCrossed,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/supabase/env";
import { formatKina } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartItem, Category, DiningTable, PaymentMethod, Product } from "@/lib/types";
import { PaymentModal } from "@/components/pos/payment-modal";
import { Receipt } from "@/components/pos/receipt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LastOrder {
  id: string;
  order_number: number;
  created_at: string;
}

interface ReceiptSnapshot {
  order: LastOrder;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  method: PaymentMethod;
  orderType: "dine_in" | "takeaway";
  tableLabel: string | null;
}

export function PosClient({
  categories,
  products,
  tables,
  restaurantId,
  restaurantName,
  restaurantAddress,
  taxRate,
  createdBy,
}: {
  categories: Category[];
  products: Product[];
  tables: DiningTable[];
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string | null;
  taxRate: number;
  createdBy: string;
}) {
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>(categories);
  const [prods, setProds] = useState<Product[]>(products);
  const [activeCategory, setActiveCategory] = useState<string | null>(
    categories[0]?.id ?? null
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [tableId, setTableId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);

  // Demo mode: reflect any changes made on other screens (localStorage store).
  useEffect(() => {
    if (!isDemoMode()) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: c } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");
      const { data: p } = await supabase
        .from("products")
        .select("*")
        .order("sort_order");
      if (!cancelled) {
        if (c) setCats(c as unknown as Category[]);
        if (p) setProds(p as unknown as Product[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      activeCategory
        ? prods.filter((p) => p.category_id === activeCategory)
        : prods,
    [prods, activeCategory]
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cart]
  );
  const tax = useMemo(
    () => Math.round(subtotal * (taxRate / 100) * 100) / 100,
    [subtotal, taxRate]
  );
  const total = Math.round((subtotal + tax) * 100) / 100;
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product_id === productId
            ? { ...i, quantity: i.quantity + delta }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
  }

  function clearCart() {
    setCart([]);
    setPayOpen(false);
  }

  async function completeSale(method: PaymentMethod) {
    if (cart.length === 0) return;
    if (orderType === "dine_in" && !tableId) {
      toast.error("Select a table for this dine-in order.");
      return;
    }
    setProcessing(true);
    const supabase = createClient();

    const items = cart.map((i) => ({
      product_id: i.product_id,
      product_name: i.name,
      quantity: i.quantity,
      unit_price: i.price,
      notes: i.notes ?? null,
    }));

    const { data, error } = await supabase.rpc("create_order", {
      v_restaurant_id: restaurantId,
      v_created_by: createdBy,
      p_items: items,
      v_method: method,
      v_order_type: orderType,
      v_table_id: orderType === "dine_in" ? tableId : null,
    });

    setProcessing(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const order = (Array.isArray(data) ? data[0] : data) as LastOrder | undefined;
    if (!order) {
      toast.error("Order could not be created.");
      return;
    }

    setPayOpen(false);
    setReceipt({
      order,
      items: cart,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
      method,
      orderType,
      tableLabel:
        orderType === "dine_in"
          ? tables.find((t) => t.id === tableId)?.label ?? null
          : null,
    });
    setCart([]);
    setTableId(null);
    router.refresh();
  }

  function printReceipt() {
    window.print();
  }

  return (
    <div className="flex h-full flex-col gap-4 print:hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Point of Sale
          </h1>
          <p className="text-sm text-muted-foreground">
            {restaurantName} tap an item to add it to the order
          </p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* Menu side */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                "shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                activeCategory === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent"
              )}
            >
              All
            </button>
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  "shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                  activeCategory === c.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-accent"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
              <UtensilsCrossed className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No products in this category yet.
                <br />
                Add some under Products.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-4 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="group flex flex-col items-start gap-1.5 rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
                >
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <UtensilsCrossed className="size-6" />
                    </span>
                  )}
                  <div className="mt-1 w-full">
                    <p className="text-sm font-medium leading-tight">{p.name}</p>
                    <p className="mt-0.5 text-sm font-semibold text-primary">
                      {formatKina(Number(p.price))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart side */}
        <aside className="flex h-fit flex-col rounded-xl border bg-card lg:sticky lg:top-20 lg:h-[calc(100svh-8rem)]">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <ShoppingCart className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Current order</span>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {itemCount}
            </span>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={clearCart}
                aria-label="Clear cart"
              >
                <Trash2 />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">
              Order type
            </span>
            <div className="ml-auto flex rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setOrderType("dine_in")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  orderType === "dine_in"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Dine in
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType("takeaway");
                  setTableId(null);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  orderType === "takeaway"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Takeaway
              </button>
            </div>
          </div>

          {orderType === "dine_in" && (
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                Table
              </span>
              <Select
                value={tableId ?? ""}
                onValueChange={(v) => setTableId(v || null)}
              >
                <SelectTrigger className="ml-auto h-8 w-44 text-xs">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No tables yet
                    </div>
                  ) : (
                    tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Your order is empty.
              </p>
            ) : (
              cart.map((item) => (
                <div key={item.product_id} className="rounded-lg border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-sm font-semibold">
                      {formatKina(item.price * item.quantity)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() => updateQuantity(item.product_id, -1)}
                      >
                        <Minus />
                      </Button>
                      <span className="w-7 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() => updateQuantity(item.product_id, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeItem(item.product_id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-auto space-y-1 border-t px-4 py-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatKina(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>GST ({taxRate}%)</span>
                <span>{formatKina(tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatKina(total)}</span>
            </div>
            <Button
              size="lg"
              className="mt-2 w-full"
              disabled={cart.length === 0}
              onClick={() => setPayOpen(true)}
            >
              Charge K{total.toFixed(2)}
            </Button>
          </div>
        </aside>
      </div>

      <PaymentModal
        open={payOpen}
        onOpenChange={setPayOpen}
        total={total}
        pending={processing}
        onComplete={completeSale}
      />

      <Dialog
        open={receipt !== null}
        onOpenChange={(open) => !open && setReceipt(null)}
      >
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="print:hidden">
            <DialogTitle>Sale complete</DialogTitle>
            <DialogDescription>
              Order #{receipt?.order.order_number} send a copy to the printer.
            </DialogDescription>
          </DialogHeader>
          {receipt && (
            <Receipt
              businessName={restaurantName}
              address={restaurantAddress}
              orderNumber={receipt.order.order_number}
              date={new Date(receipt.order.created_at)}
              items={receipt.items}
              subtotal={receipt.subtotal}
              tax={receipt.tax}
              total={receipt.total}
              method={receipt.method}
              orderType={receipt.orderType}
              tableLabel={receipt.tableLabel}
            />
          )}
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" onClick={printReceipt}>
              <Printer />
              Print receipt
            </Button>
            <Button onClick={() => setReceipt(null)}>New sale</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}