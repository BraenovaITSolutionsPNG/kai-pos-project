import { formatKina } from "@/lib/format";
import type { CartItem, PaymentMethod } from "@/lib/types";
import { paymentMethodLabel } from "@/lib/format";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function Receipt({
  businessName,
  address,
  orderNumber,
  date,
  items,
  subtotal,
  tax,
  total,
  method,
  orderType,
  tableLabel,
}: {
  businessName: string;
  address?: string | null;
  orderNumber: number;
  date: Date;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  method: PaymentMethod;
  orderType: "dine_in" | "takeaway";
  tableLabel: string | null;
}) {
  const d = date;
  const dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return (
    <div className="receipt-print mx-auto w-full max-w-[300px] bg-white p-4 font-mono text-[12px] leading-relaxed text-black">
      <div className="text-center">
        <p className="text-sm font-bold uppercase">{businessName}</p>
        {address ? <p>{address}</p> : null}
        <p>Port Moresby, Papua New Guinea</p>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>Order #</span>
        <span>{orderNumber}</span>
      </div>
      <div className="flex justify-between">
        <span>Date</span>
        <span>{dateStr}</span>
      </div>
      <div className="flex justify-between">
        <span>Time</span>
        <span>{timeStr}</span>
      </div>
      <div className="flex justify-between">
        <span>Type</span>
        <span>{orderType === "takeaway" ? "Takeaway" : "Dine in"}</span>
      </div>
      {orderType === "dine_in" && tableLabel ? (
        <div className="flex justify-between">
          <span>Table</span>
          <span>{tableLabel}</span>
        </div>
      ) : null}
      <div className="my-2 border-t border-dashed border-black" />
      {items.map((item) => (
        <div key={item.product_id}>
          <div className="flex justify-between gap-2">
            <span className="whitespace-nowrap">
              {item.quantity} x {item.name}
            </span>
            <span>{formatKina(item.quantity * item.price)}</span>
          </div>
          <div className="flex justify-between pl-2 text-[11px] text-neutral-600">
            <span>{formatKina(item.price)} each</span>
            <span />
          </div>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatKina(subtotal)}</span>
      </div>
      {tax > 0 && (
        <div className="flex justify-between">
          <span>GST</span>
          <span>{formatKina(tax)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatKina(total)}</span>
      </div>
      <div className="flex justify-between">
        <span>Payment</span>
        <span>{paymentMethodLabel(method)}</span>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center">Thank you, please come again!</p>
    </div>
  );
}