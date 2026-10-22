"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatKina } from "@/lib/format";
import { ShoppingCart, UtensilsCrossed, Clock, CheckCircle, Loader2, X, Plus, Minus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface MenuProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  ingredients: string | null;
  prep_time: number;
  category_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Table {
  id: string;
  label: string;
}

interface CartItem {
  product: MenuProduct;
  quantity: number;
}

interface ProductDescriptionProps {
  description: string;
}

function ProductDescription({ description }: ProductDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 80;
  const needsTruncation = description.length > maxLength;

  if (!needsTruncation) {
    return (
      <p className="mt-1.5 text-sm text-muted-foreground">
        {description}
      </p>
    );
  }

  return (
    <div className="mt-1.5">
      <p className={`text-sm text-muted-foreground ${expanded ? '' : 'line-clamp-3'}`}>
        {description}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="mt-1 text-xs font-medium text-primary hover:underline"
      >
        {expanded ? 'Read less' : 'Read more'}
      </button>
    </div>
  );
}

function PromoSlideView({ slide }: { slide: PromoSlide }) {
  if (slide.image_url) {
    return (
      <div className="relative min-w-full h-72 shadow-md sm:h-96">
        <img
          src={slide.image_url}
          alt={slide.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end px-6 pb-16 text-white sm:px-10">
          <h3 className="font-heading text-2xl font-bold sm:text-4xl">{slide.title}</h3>
          {slide.subtitle && (
            <p className="mt-2 text-sm opacity-95 sm:text-lg">{slide.subtitle}</p>
          )}
        </div>
      </div>
    );
  }
  return (
        <div className="flex min-w-full h-72 flex-col justify-end bg-gradient-to-r from-slate-700 to-slate-900 px-6 pb-16 text-white shadow-md sm:h-96 sm:px-10">
      <h3 className="font-heading text-2xl font-bold sm:text-4xl">{slide.title}</h3>
      {slide.subtitle && (
        <p className="mt-2 text-sm opacity-95 sm:text-lg">{slide.subtitle}</p>
      )}
    </div>
  );
}

function PromoSlider({
  restaurantName,
  promotions,
}: {
  restaurantName: string;
  promotions?: PromoSlide[];
}) {
  const fallback: PromoSlide[] = [
    {
      id: "fallback-1",
      title: `Today's Specials at ${restaurantName}`,
      subtitle: "Ask your waiter for the chef's recommendations",
      image_url: null,
    },
    {
      id: "fallback-2",
      title: "Happy Hour 4pm - 6pm",
      subtitle: "15% off all drinks at the counter",
      image_url: null,
    },
    {
      id: "fallback-3",
      title: "Live Music Fridays",
      subtitle: "Join us for a great night out",
      image_url: null,
    },
  ];

  const slides = promotions && promotions.length > 0 ? promotions : fallback;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides]);

  return (
    <div className="relative overflow-hidden bg-muted" aria-roledescription="carousel">
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide) => (
          <PromoSlideView key={slide.id} slide={slide} />
        ))}
      </div>
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show slide ${i + 1}`}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i === index ? "bg-white" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function MenuClient({
  categories,
  products,
  tables,
  restaurantName,
  restaurantId,
  preselectedTableId,
  promotions,
}: {
  categories: Category[];
  products: MenuProduct[];
  tables: Table[];
  restaurantName: string;
  restaurantId: string;
  preselectedTableId?: string;
  promotions?: PromoSlide[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>(preselectedTableId ?? "");
  const [view, setView] = useState<"menu" | "cart" | "confirm">("menu");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ order_id: string; order_number: number; total: number } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (preselectedTableId && !tables.some((t) => t.id === preselectedTableId)) {
      const match = tables.find((t) => t.label === preselectedTableId);
      if (match) setSelectedTable(match.id);
    }
  }, [preselectedTableId, tables]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  function addToCart(product: MenuProduct) {
    if (!product.is_active) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartOpen(true);
    toast.success(`${product.name} added to cart`);
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function clearCart() {
    setCart([]);
    setCartOpen(false);
  }

  async function submitOrder() {
    if (!selectedTable) {
      toast.error("Please select a table");
      return;
    }
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const items = cart.map((i) => ({
      product_id: i.product.id,
      quantity: i.quantity,
      notes: null,
    }));

    const { data, error } = await supabase.rpc("create_customer_order", {
      p_restaurant: restaurantId,
      p_table: selectedTable,
      p_items: items,
    });

    setSubmitting(false);

    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "Failed to place order");
      return;
    }

    setOrderResult({
      order_id: data.order_id,
      order_number: data.order_number,
      total: data.total,
    });
    setView("confirm");
    clearCart();
  }

  const formatTime = (minutes: number) => {
    if (minutes <= 0) return "Ready soon";
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (view === "confirm" && orderResult) {
    const tableLabel = selectedTable
      ? (tables.find((t) => t.id === selectedTable)?.label ?? selectedTable)
      : null;
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-md bg-card rounded-xl border p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">Order Placed!</h1>
          <p className="mt-2 text-muted-foreground">
            Your order <span className="font-mono font-semibold">#{orderResult.order_number}</span> has been sent to the kitchen.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Unpaid - pay at the counter
            </span>
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatKina(orderResult.total)}</span>
              {tableLabel && (
                <>
                  <span className="mx-2 text-muted-foreground">|</span>
                  Table: <span className="font-semibold text-foreground">{tableLabel}</span>
                </>
              )}
            </p>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Please pay at the counter, or request the bill from a waiter.
          </p>

          <Button className="mt-8 w-full" onClick={() => { setView("menu"); setOrderResult(null); }}>
            <UtensilsCrossed className="mr-2 h-4 w-4" />
            Order More
          </Button>
          <Button variant="outline" className="mt-4 w-full" onClick={() => window.location.reload()}>
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-heading font-semibold">{restaurantName}</h1>
              <p className="text-xs text-muted-foreground">Digital Menu - Order from your table</p>
            </div>
          </div>
          <Button
            variant={cartCount > 0 ? "default" : "outline"}
            className="relative"
            onClick={() => { setView("cart"); setCartOpen(true); }}
            disabled={view === "cart"}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                {cartCount}
              </span>
            )}
            {cartCount > 0 && (
              <span className="ml-2 text-sm font-medium">{formatKina(cartTotal)}</span>
            )}
          </Button>
        </div>
      </header>

      <PromoSlider restaurantName={restaurantName} promotions={promotions} />

      <main className="flex-1 flex flex-col">
        {view === "menu" && (
          <>
            {categories.length > 1 && (
              <nav className="border-b bg-card px-2 py-2 sticky top-[60px] z-10" aria-label="Menu categories">
                <div className="h-12 overflow-x-auto flex gap-2 pb-2">
                  <div className="flex gap-2 min-w-max pb-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        !selectedCategory
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                          selectedCategory === cat.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
</div>
                </nav>
            )}

            <div className="flex-1 overflow-y-auto p-4 pb-24">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <UtensilsCrossed className="h-12 w-12 mb-4 opacity-50" />
                  <p>No items in this category</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <article
                      key={product.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => addToCart(product)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          addToCart(product);
                        }
                      }}
                      className="group flex flex-col rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    >
                      {product.image_url ? (
                        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                          <UtensilsCrossed className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold flex-1 pr-2">{product.name}</h3>
                          <span className="font-heading font-semibold text-primary whitespace-nowrap">
                            {formatKina(product.price)}
                          </span>
                        </div>
                        {product.ingredients && (
                          <ProductDescription description={product.ingredients} />
                        )}
                        <div className="mt-auto flex items-center justify-between pt-2">
                          {product.prep_time > 0 && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              {formatTime(product.prep_time)}
                            </Badge>
                          )}
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product);
                              }}
                              disabled={!product.is_active}
                              aria-label={`Add ${product.name} to cart`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add
                            </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === "cart" && cart.length > 0 && (
          <div className="flex-1 flex flex-col">
            <div className="border-b bg-card px-4 py-3 sticky top-0 z-10">
              <h2 className="font-heading font-semibold">Your Cart ({cartCount})</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="h-full overflow-y-auto">
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex gap-3 p-3 rounded-lg border bg-background"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium truncate">{item.product.name}</h4>
                          <span className="font-heading font-medium text-primary whitespace-nowrap">
                            {formatKina(item.product.price * item.quantity)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatKina(item.product.price)} each
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.product.id, -item.quantity)} aria-label="Remove">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <div className="flex justify-between text-lg font-semibold mb-4">
                  <span>Total</span>
                  <span>{formatKina(cartTotal)}</span>
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium mb-1 block">Table Number</span>
                    <select
                      value={selectedTable}
                      onChange={(e) => setSelectedTable(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      required
                    >
                      <option value="">Select your table</option>
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {selectedTable && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        You are ordering for <strong>{tables.find(t => t.id === selectedTable)?.label}</strong>
                      </p>
                    )}
                  </label>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={submitOrder}
                    disabled={submitting || !selectedTable || cart.length === 0}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <UtensilsCrossed className="mr-2 h-4 w-4" />
                        Place Order &mdash; {formatKina(cartTotal)}
                      </>
                    )}
                  </Button>

                  <Button variant="outline" className="w-full" onClick={() => { setView("menu"); setCartOpen(false); }}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Continue Browsing
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "cart" && cart.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
            <h3 className="font-semibold text-lg">Your cart is empty</h3>
            <p className="text-sm mt-1">Add some delicious items from the menu</p>
            <Button className="mt-4" onClick={() => setView("menu")}>
              <UtensilsCrossed className="mr-2 h-4 w-4" />
              Browse Menu
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
