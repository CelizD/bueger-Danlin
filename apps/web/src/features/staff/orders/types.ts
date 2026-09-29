import type { AdminDeliveryGroup } from "../components/admin-delivery-groups";

export type StaffUser = {
  id?: string;
  sub?: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
};

export type OrderModifier = {
  id: string;
  optionName: string;
  priceDeltaCents: number;
  quantity: number;
  removed: boolean;
};

export type OrderItem = {
  id: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  modifiers: OrderModifier[];
};

export type AdminOrder = {
  id: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  comboQuantity: number;
  groupDeliveryFinalFeeCents: number | null;
  groupDeliveryFinalizedAt: string | null;
  refundIssue: {
    required: true;
    amountCents: number;
    provider: string;
    reason: string;
    detectedAt: string | null;
    lastAttemptFailed: boolean;
  } | null;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  pickupEvent: {
    id: string;
    code: string;
    name: string;
    locationLabel: string;
    startsAt: string;
    closesAt: string;
    timezone: string;
    pickupPoint: {
      id: string;
      code: string;
      name: string;
      address: string | null;
    };
  };
  items: OrderItem[];
  statusHistory: Array<{
    id: string;
    from: string | null;
    to: string;
    note: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    provider: string;
    status: string;
    amountCents: number;
    paidAt: string | null;
    refundedAt: string | null;
  }>;
};

export type OrdersResponse = {
  summary: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    totalCombos: number;
    paidRevenueCents: number;
    finalDeliveryCashCents: number;
    activeGroups: number;
    manualRefundsPending: number;
    manualRefundsPendingCents: number;
  };
  groups: AdminDeliveryGroup[];
  orders: AdminOrder[];
};
