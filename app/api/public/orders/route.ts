import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      restaurant_id,
      customer_name,
      customer_phone,
      customer_email,
      delivery_address,
      delivery_notes,
      items,
      order_type = "takeaway",
    } = body;

    if (!restaurant_id || !customer_name || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify restaurant exists
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurant_id)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    // Fetch products to get prices
    const productIds = items.map((i: any) => i.product_id);
    const { data: products } = await supabase
      .from("products")
      .select("id, name, price, is_active")
      .in("id", productIds);

    if (!products || products.length === 0) {
      return NextResponse.json({ error: "No valid products" }, { status: 400 });
    }

    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // Calculate totals
    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const product = productMap.get(item.product_id);
      if (!product || !product.is_active) throw new Error("Invalid product: " + item.product_id);
      const unitPrice = Number(product.price);
      const qty = Number(item.quantity) || 1;
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      return {
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        notes: item.notes || null,
      };
    });

    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id,
        order_source: "online",
        order_type,
        status: "open",
        subtotal,
        tax,
        total,
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        delivery_address: delivery_address || null,
        delivery_notes: delivery_notes || null,
        delivery_status: order_type === "delivery" ? "pending" : null,
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || "Failed to create order" }, { status: 500 });
    }

    // Create order items
    const itemsWithOrderId = orderItems.map((oi: any) => ({
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
      total,
      estimated_delivery: order_type === "delivery" ? "30-45 minutes" : null,
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
