"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatKina } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle, Truck, Store } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  image_url: string | null;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes: string;
}

interface Restaurant {
  id: string;
  name: string;
}

export function OnlineOrderClient() {
  const params = useParams();
  const restaurantId = params?.id as string | undefined;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"menu" | "checkout" | "confirmation">("menu");
  const [orderType, setOrderType] = useState<"takeaway" | "delivery">("takeaway");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadMenu() {
      setLoading(true);
      let query = supabase.from("restaurants").select("id, name");
      if (restaurantId) {
        query = query.eq("id", restaurantId);
      } else {
        query = query.limit(1);
      }
      const { data: restaurants } = await query;
      if (restaurants && restaurants.length > 0) {
        const r = restaurants[0];
        setRestaurant(r);
        const [catRes, prodRes] = await Promise.all([
          supabase.from("categories").select("id, name").eq("restaurant_id", r.id),
          supabase.from("products").select("id, name, price, category_id, image_url, is_active").eq("restaurant_id", r.id).eq("is_active", true),
        ]);
        if (catRes.data) setCategories(catRes.data as Category[]);
        if (prodRes.data) setProducts(prodRes.data as Product[]);
      }
      setLoading(false);
    }
    loadMenu();
  }, [restaurantId]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: Number(product.price), notes: "" }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.product_id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  async function submitOrder() {
    if (!customerName.trim()) {
      toast.error("Name is required");
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast.error("Delivery address is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurant?.id,
          customer_name: customerName,
          customer_phone: customerPhone || null,
          customer_email: customerEmail || null,
          delivery_address: orderType === "delivery" ? deliveryAddress : null,
          delivery_notes: deliveryNotes || null,
          order_type: orderType,
          items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes || null })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrderResult(data);
        setStep("confirmation");
        setCart([]);
      } else {
        toast.error(data.error || "Failed to place order");
      }
    } catch (e) {
      toast.error("Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (step === "confirmation" && orderResult) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
        <div className="mx-auto max-w-lg">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="size-16 text-green-500" />
              <h1 className="font-heading text-2xl font-semibold">Order Placed!</h1>
              <p className="text-muted-foreground text-center">
                Your order #{orderResult.order_number} has been received.
              </p>
              <div className="text-center">
                <p className="text-lg font-semibold">{formatKina(orderResult.total)}</p>
                {orderResult.estimated_delivery && (
                  <p className="text-sm text-muted-foreground">
                    Estimated delivery: {orderResult.estimated_delivery}
                  </p>
                )}
              </div>
              <Button onClick={() => { setStep("menu"); setOrderResult(null); }}>
                Place Another Order
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "checkout") {
    return (
      <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-2xl font-semibold">Checkout</h1>
            <Button variant="outline" onClick={() => setStep("menu")}>Back to Menu</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order Type</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button
                variant={orderType === "takeaway" ? "default" : "outline"}
                onClick={() => setOrderType("takeaway")}
                className="flex-1"
              >
                <Store className="size-4" />
                Takeaway
              </Button>
              <Button
                variant={orderType === "delivery" ? "default" : "outline"}
                onClick={() => setOrderType("delivery")}
                className="flex-1"
              >
                <Truck className="size-4" />
                Delivery
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </div>
              {orderType === "delivery" && (
                <div className="space-y-2">
                  <Label>Delivery Address *</Label>
                  <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cart.map((item) => (
                <div key={item.product_id} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.product_name}</span>
                  <span>{formatKina(item.unit_price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatKina(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (10%)</span>
                  <span>{formatKina(tax)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatKina(total)}</span>
                </div>
              </div>
              <Button className="w-full mt-4" onClick={submitOrder} disabled={submitting}>
                {submitting ? "Placing Order..." : "Place Order"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Menu view
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-card px-4 py-3">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <h1 className="font-heading text-xl font-semibold">{restaurant?.name || "Online Order"}</h1>
          <Button variant="outline" size="sm" onClick={() => setStep("checkout")} disabled={cart.length === 0}>
            <ShoppingCart className="size-4" />
            Cart ({cartCount})
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 space-y-6">
        {categories.map((cat) => {
          const catProducts = products.filter((p) => p.category_id === cat.id);
          if (catProducts.length === 0) return null;
          return (
            <div key={cat.id} className="space-y-3">
              <h2 className="font-heading text-lg font-semibold">{cat.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {catProducts.map((product) => {
                  const cartItem = cart.find((i) => i.product_id === product.id);
                  return (
                    <Card key={product.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{formatKina(Number(product.price))}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {cartItem ? (
                            <>
                              <Button size="icon" variant="outline" className="size-8" onClick={() => updateQty(product.id, -1)}>
                                <Minus className="size-3" />
                              </Button>
                              <span className="w-6 text-center font-medium">{cartItem.quantity}</span>
                              <Button size="icon" variant="outline" className="size-8" onClick={() => updateQty(product.id, 1)}>
                                <Plus className="size-3" />
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" onClick={() => addToCart(product)}>
                              <Plus className="size-4" />
                              Add
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

        {products.filter((p) => !p.category_id).length > 0 && (
          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Other Items</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.filter((p) => !p.category_id).map((product) => {
                const cartItem = cart.find((i) => i.product_id === product.id);
                return (
                  <Card key={product.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{formatKina(Number(product.price))}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {cartItem ? (
                          <>
                            <Button size="icon" variant="outline" className="size-8" onClick={() => updateQty(product.id, -1)}>
                              <Minus className="size-3" />
                            </Button>
                            <span className="w-6 text-center font-medium">{cartItem.quantity}</span>
                            <Button size="icon" variant="outline" className="size-8" onClick={() => updateQty(product.id, 1)}>
                              <Plus className="size-3" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => addToCart(product)}>
                            <Plus className="size-4" />
                            Add
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

