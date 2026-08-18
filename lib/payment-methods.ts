// Payment methods for subscription payments. Banks are NOT payment methods:
// they live in a separate "Bank" dropdown that appears when a transfer-type
// method (bank transfer / online bank transfer / mobile banking) is chosen.
export const PAYMENT_METHODS = [
  "bank_transfer",
  "online_bank_transfer",
  "mobile_banking",
  "eftpos",
  "visa_card",
  "cash",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Banks shown in the separate "Bank" field for transfer-type methods.
export const BANK_OPTIONS = [
  "bsp",
  "kina_bank",
  "anz",
  "westpac",
  "other",
] as const;

export type BankOption = (typeof BANK_OPTIONS)[number];

export function isTransferMethod(method: string): boolean {
  return (
    method === "bank_transfer" ||
    method === "online_bank_transfer" ||
    method === "mobile_banking"
  );
}

export interface PaymentMethodHint {
  label: string;
  description: string;
  referenceLabel: string;
  referenceRequired: boolean;
  referencePlaceholder: string;
  proofLabel: string;
  proofRequired: boolean;
  comingSoon?: boolean;
}

const TRANSFER_GROUP: PaymentMethodHint = {
  label: "Bank Deposit",
  description:
    "Choose the bank in the field below, deposit the amount, then attach the deposit screenshot.",
  referenceLabel: "Deposit reference number",
  referenceRequired: true,
  referencePlaceholder: "e.g. BSP 1234 5678 9012",
  proofLabel: "Screenshot of the deposit",
  proofRequired: true,
};

export const PAYMENT_METHOD_HINTS: Record<PaymentMethod, PaymentMethodHint> = {
  bank_transfer: { ...TRANSFER_GROUP },
  online_bank_transfer: {
    ...TRANSFER_GROUP,
    label: "Online bank transfer",
    description:
      "Transfer online from any bank — pick the bank below, then attach the transfer screenshot.",
  },
  mobile_banking: {
    ...TRANSFER_GROUP,
    label: "Mobile banking",
    description:
      "Transfer from your mobile banking app — pick the bank below, then attach the transfer screenshot.",
  },
  eftpos: {
    label: "EFTPOS",
    description:
      "Paid by card at the terminal — attach the EFTPOS receipt so the admin can verify.",
    referenceLabel: "Receipt / transaction number",
    referenceRequired: false,
    referencePlaceholder: "e.g. receipt no. 48291",
    proofLabel: "Screenshot of the EFTPOS receipt",
    proofRequired: true,
  },
  cash: {
    label: "Cash",
    description:
      "Cash payment made at our office — add a receipt or note if you have one.",
    referenceLabel: "Receipt / note (optional)",
    referenceRequired: false,
    referencePlaceholder: "optional",
    proofLabel: "Screenshot of receipt (optional)",
    proofRequired: false,
  },
  visa_card: {
    label: "VISA Card",
    description: "Pay securely with your VISA card.",
    referenceLabel: "Card reference",
    referenceRequired: false,
    referencePlaceholder: "—",
    proofLabel: "Receipt (optional)",
    proofRequired: false,
    comingSoon: true,
  },
  other: {
    label: "Other",
    description: "Describe how you paid and attach proof if available.",
    referenceLabel: "Reference / note",
    referenceRequired: false,
    referencePlaceholder: "e.g. MFS / M-Cash transfer",
    proofLabel: "Screenshot (optional)",
    proofRequired: false,
  },
};

export function paymentMethodHint(method: string): PaymentMethodHint {
  return PAYMENT_METHOD_HINTS[method as PaymentMethod] ?? PAYMENT_METHOD_HINTS.other;
}

export function paymentMethodLabel(method: string): string {
  return (
    PAYMENT_METHOD_HINTS[method as PaymentMethod]?.label ??
    method.replace("_", " ")
  );
}