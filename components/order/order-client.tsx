"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKina } from "@/lib/format";
import { ShoppingCart, UtensilsCrossed, Clock, CheckCircle, Loader2, X, Plus, Minus, ArrowLeft, MapPin, Phone, Truck, Home, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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

interface PromoSlide {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
}

interface CartItem {
  product: MenuProduct;
  quantity: number;
  notes?: string;
}

interface OrderResult {
  order_id: string;
  order_number: number;
  total: number;
  estimated_ready_time: string;
  estimated_ready_at: string;
}

function ProductDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 80;
  const needsTruncation = description.length > maxLength;

  if (!needsTruncation) {
    return (
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    );
  }

  return (
    <div className="mt-1.5">
      <p className={`text-sm text-muted-foreground ${expanded ? "" : "line-clamp-3"}`}>
        {description}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="mt-1 text-xs font-medium text-primary hover:underline"
      >
        {expanded ? "Read less" : "Read more"}
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
      subtitle: "Order for pickup or delivery",
      image_url: null,
    },
    {
      id: "fallback-2",
      title: "Fast Pickup",
      subtitle: "Ready in 15-20 minutes",
      image_url: null,
    },
    {
      id: "fallback-3",
      title: "Delivery Available",
      subtitle: "Check if we deliver to your area",
      image_url: null,
    },
  ];

  const slides = promotions && promotions.length > 0 ? promotions : fallback;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides]);

  return (
    <div className="relative overflow-hidden bg-muted rounded-xl" aria-roledescription="carousel">
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

function NotesDialog({
  item,
  onClose,
  onSave,
}: {
  item: CartItem;
  onClose: () => void;
  onSave: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(item.notes ?? "");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Notes for {item.product.name}</DialogTitle>
          <DialogDescription>
            Special instructions (e.g., no onions, extra spicy)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="No onions, extra spicy, etc."
              className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => { onSave(notes); onClose(); }}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrderClient({
  categories,
  products,
  promotions,
  restaurantName,
  restaurantId,
  restaurantPhone,
  restaurantAddress,
}: {
  categories: Category[];
  products: MenuProduct[];
  promotions?: PromoSlide[];
  restaurantName: string;
  restaurantId: string;
  restaurantPhone?: string | null;
  restaurantAddress?: string | null;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [view, setView] = useState<"menu" | "cart" | "customer" | "confirm">("menu");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [editingNotes, setEditingNotes] = useState<CartItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  // Customer info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const maxPrepTime = useMemo(() => {
    if (cart.length === 0) return 15;
    return Math.max(...cart.map((i) => i.product.prep_time || 15));
  }, [cart]);

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
  }

  function openNotes(item: CartItem) {
    setEditingNotes(item);
  }

  function saveNotes(notes: string) {
    if (!editingNotes) return;
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === editingNotes.product.id ? { ...i, notes } : i
      )
    );
    setEditingNotes(null);
  }

  async function submitOrder() {
    // Validation
    if (!customerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!customerPhone.trim()) {
      toast.error("Please enter your phone number");
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast.error("Please enter delivery address");
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
      notes: i.notes ?? null,
      unit_price: i.product.price,
    }));

    const customer = {
      name: customerName.trim(),
      phone: customerPhone.trim(),
      notes: customerNotes.trim() || null,
      type: orderType,
      address: orderType === "delivery" ? deliveryAddress.trim() : null,
      pickup_time: pickupTime || null,
    };

    const { data, error } = await supabase.rpc("create_takeaway_order", {
      p_restaurant: restaurantId,
      p_items: items,
      p_customer: customer,
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
      estimated_ready_time: data.estimated_ready_time,
      estimated_ready_at: data.estimated_ready_at,
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

  // Confirmation view
  if (view === "confirm" && orderResult) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-md bg-card rounded-xl border p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">Order Placed!</h1>
          <p className="mt-2 text-muted-foreground">
            Your order <span className="font-mono font-semibold">#{orderResult.order_number}</span> has been received.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              {orderType === "delivery" ? "Delivery" : "Pickup"} - pay on collection
            </span>
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatKina(orderResult.total)}</span>
            </p>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Ready by: <span className="font-semibold text-foreground">{orderResult.estimated_ready_time}</span>
            </p>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            We&apos;ll send you an SMS when your order is ready.
            {orderType === "delivery" && (
              <span className="block mt-2">
                Delivering to: <span className="font-semibold text-foreground">{deliveryAddress}</span>
              </span>
            )}
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
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-heading text-lg font-semibold">{restaurantName}</h1>
              <p className="text-xs text-muted-foreground">Order for {orderType === "delivery" ? "Delivery" : "Pickup"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cartCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="relative gap-1"
                onClick={() => { setView("cart"); setCartOpen(false); }}
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="font-medium">{cartCount}</span>
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-[10px]">
                  {cartCount}
                </Badge>
                <span className="font-semibold ml-1">{formatKina(cartTotal)}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Order Type Selector */}
      <div className="border-b bg-background/50 p-4">
        <div className="container flex items-center justify-center gap-4">
          <Button
            variant={orderType === "pickup" ? "default" : "outline"}
            size="sm"
            onClick={() => setOrderType("pickup")}
            className="flex-1 sm:flex-none gap-2"
          >
            <Home className="h-4 w-4" />
            Pickup
          </Button>
          <Button
            variant={orderType === "delivery" ? "default" : "outline"}
            size="sm"
            onClick={() => setOrderType("delivery")}
            className="flex-1 sm:flex-none gap-2"
          >
            <Truck className="h-4 w-4" />
            Delivery
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-24">
        {view === "menu" && (
          <div className="container p-4">
            {/* Promo Slider */}
            <PromoSlider restaurantName={restaurantName} promotions={promotions} />

            {/* Categories */}
            {categories.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <Tabs
                  value={selectedCategory ?? "all"}
                  onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}
                  className="flex gap-2 pb-2"
                >
                  <TabsList className="grid w-auto gap-1 bg-transparent p-0">
                    <TabsTrigger value="all" className="px-4 py-2">
                      All
                    </TabsTrigger>
                    {categories.map((c) => (
                      <TabsTrigger key={c.id} value={c.id} className="px-4 py-2">
                        {c.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Products Grid */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  No items in this category.
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="group relative flex cursor-pointer flex-col rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-lg"
                    onClick={() => addToCart(product)}
                  >
                    {product.image_url && (
                      <div className="relative aspect-video overflow-hidden">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        {!product.is_active && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm font-medium">
                            Unavailable
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm leading-tight">{product.name}</h3>
                        <span className="font-semibold text-foreground whitespace-nowrap">
                          {formatKina(product.price)}
                        </span>
                      </div>
                      {product.ingredients && (
                        <ProductDescription description={product.ingredients} />
                      )}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(product.prep_time || 15)}
                        </span>
                        {!product.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Unavailable
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === "cart" && (
          <div className="container p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-semibold">Your Cart</h2>
              <Button variant="ghost" size="sm" onClick={() => setView("menu")}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Continue Ordering
              </Button>
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                <p>Your cart is empty</p>
                <Button className="mt-4" onClick={() => setView("menu")}>
                  <UtensilsCrossed className="mr-2 h-4 w-4" />
                  Browse Menu
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    {item.product.image_url && (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="h-16 w-16 rounded-md object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-sm">{item.product.name}</h4>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-semibold text-sm whitespace-nowrap">
                          {formatKina(item.product.price * item.quantity)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, -1); }}
                            className="h-8 w-8"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="font-medium w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, 1); }}
                            className="h-8 w-8"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openNotes(item); }}
                          className="text-xs gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Notes
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, -item.quantity); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatKina(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Estimated prep time</span>
                    <span>{formatTime(maxPrepTime)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>{formatKina(cartTotal)}</span>
                  </div>

                  <Button
                    className="w-full mt-4"
                    size="lg"
                    onClick={() => setView("customer")}
                    disabled={cart.length === 0}
                  >
                    Checkout
                    <ArrowLeft className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "customer" && (
          <div className="container p-4 max-w-md mx-auto">
            <div className="mb-6">
              <Button variant="ghost" size="sm" onClick={() => setView("cart")} className="mb-4">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Cart
              </Button>
              <h2 className="font-heading text-xl font-semibold">Your Details</h2>
              <p className="text-sm text-muted-foreground mt-1">
                We&apos;ll use this to contact you about your order
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+675 7xxx xxxx"
                  required
                />
              </div>

              {orderType === "delivery" && (
                <div className="space-y-2">
                  <Label htmlFor="address">Delivery Address *</Label>
                  <textarea
                    id="address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Street, suburb, landmarks"
                    className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="pickupTime">Pickup Time (optional)</Label>
                <Input
                  id="pickupTime"
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Order Notes (optional)</Label>
                <textarea
                  id="notes"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Allergies, special requests, gate code, etc."
                  className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {restaurantAddress && orderType === "delivery" && (
                <div className="rounded-lg border bg-amber-50 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-200 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Delivery Area Check</p>
                      <p>We&apos;ll confirm if we can deliver to your address. Restaurant location: {restaurantAddress}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 space-y-3">
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatKina(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Estimated prep</span>
                  <span>{formatTime(maxPrepTime)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatKina(cartTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Pay on {orderType === "delivery" ? "delivery" : "pickup"} (Cash, EFTPOS, Bank Transfer)
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={submitOrder}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    Place Order
                    <ArrowLeft className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Restaurant Info Footer */}
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
          <div className="container mx-auto max-w-md text-center text-sm text-muted-foreground space-y-1">
            <p className="font-medium">{restaurantName}</p>
            {restaurantPhone && (
              <p className="flex items-center justify-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {restaurantPhone}
              </p>
            )}
            {restaurantAddress && (
              <p className="flex items-center justify-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {restaurantAddress}
              </p>
            )}
          </div>
        </div>
      </main>

      {editingNotes && (
        <NotesDialog
          item={editingNotes}
          onClose={() => setEditingNotes(null)}
          onSave={saveNotes}
        />
      )}
    </div>
  );
}