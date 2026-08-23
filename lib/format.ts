import type { PaymentMethod } from "@/lib/types";

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  eftpos: "EFTPOS",
  bank_transfer: "Bank Transfer",
  bsp: "BSP",
  kina_bank: "Kina Bank",
  anz: "ANZ",
  westpac: "Westpac",
  other: "Other",
};

export function formatKina(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return `K${value.toLocaleString("en-PG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return paymentLabels[method] ?? method;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "eftpos",
  "bank_transfer",
  "bsp",
  "kina_bank",
  "anz",
  "westpac",
  "other",
];

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-PG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-PG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-PG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}