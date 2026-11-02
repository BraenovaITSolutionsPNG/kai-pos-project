import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PublicOrderItemInput = {
  product_id: string;
  quantity: number;
  notes: string | null;
};

type PublicOrderProduct = {
  id: string;
  name: string;
  price: number | string;
  is_active: boolean;
};

function parseOrderItems(value: unknown): PublicOrderItemInput[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const parsed: PublicOrderItemInput[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const item = entry as Record<string, unknown>;
    if (
      typeof item.product_id !== "string" ||
      !item.product_id.trim() ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) < 1
    ) {
      return null;
    }
    parsed.push({
      product_id: item.product_id.trim(),
      quantity: Number(item.quantity),
      notes: typeof item.notes === "string" ? item.notes.trim() || null : null,
    });
  }
  return parsed;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const restaurantId = typeof payload.restaurant_id === "string" ? payload.restaurant_id : "";
    const customerName = typeof payload.customer_name === "string" ? payload.customer_name.trim() : "";
    const orderType = payload.order_type === undefined ? "takeaway" : payload.order_type;
    const deliveryAddress = typeof payload.delivery_address === "string" ? payload.delivery_address.trim() : "";
    const items = parseOrderItems(payload.items);

    if (!restaurantId || !customerName || !items) {
      return NextResponse.json({ error: "Enter your name and add valid items to the order" }, { status: 400 });
    }
    if (orderType !== "takeaway" && orderType !== "delivery") {
      return NextResponse.json({ error: "Invalid order type" }, { status: 400 });
    }
    if (orderType === "delivery" && !deliveryAddress) {
      return NextResponse.json({ error: "Delivery address is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Load the restaurant's configured tax rate on the server.
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, name, tax_rate")
      .eq("id", restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    // Only accept active products belonging to the selected restaurant.
    const productIds = [...new Set(items.map((item) => item.product_id))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, is_active")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .in("id", productIds);

    if (productsError) {
      return NextResponse.json({ error: "Could not validate menu items" }, { status: 500 });
    }

    const validProducts = (products ?? []) as PublicOrderProduct[];
    const productMap = new Map(validProducts.map((product) => [product.id, product]));
    if (productMap.size !== productIds.length) {
      return NextResponse.json({ error: "One or more items are unavailable" }, { status: 400 });
    }

    let subtotal = 0;
    const orderItems = items.map((item) => {
      const product = productMap.get(item.product_id);
      if (!product || !product.is_active) return null;
      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      return {
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        notes: item.notes,
      };
    });
    if (orderItems.some((item) => item === null)) {
      return NextResponse.json({ error: "One or more items are unavailable" }, { status: 400 });
    }

    const cleanOrderItems = orderItems.filter((item) => item !== null);
    subtotal = roundMoney(subtotal);
    const taxRate = Number(restaurant.tax_rate) || 0;
    const tax = roundMoney((subtotal * taxRate) / 100);
    const total = roundMoney(subtotal + tax);

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        order_source: "online",
        order_type: orderType,
        status: "open",
        subtotal,
        tax,
        total,
        customer_name: customerName,
        customer_phone: typeof payload.customer_phone === "string" ? payload.customer_phone.trim() || null : null,
        customer_email: typeof payload.customer_email === "string" ? payload.customer_email.trim() || null : null,
        delivery_address: deliveryAddress || null,
        delivery_notes: typeof payload.delivery_notes === "string" ? payload.delivery_notes.trim() || null : null,
        delivery_status: orderType === "delivery" ? "pending" : null,
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || "Failed to create order" }, { status: 500 });
    }

    // Create order items
    const itemsWithOrderId = cleanOrderItems.map((oi) => ({
      ...oi,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(itemsWithOrderId);
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      subtotal: Number(order.subtotal ?? subtotal),
      tax: Number(order.tax ?? tax),
      tax_rate: taxRate,
      total: Number(order.total ?? total),
      estimated_delivery: orderType === "delivery" ? "30-45 minutes" : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, order_items(*), restaurants(name)")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
