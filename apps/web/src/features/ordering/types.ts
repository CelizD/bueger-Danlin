export type ModifierOption = {
  id: string;
  name: string;
  kind: "REMOVABLE" | "EXTRA" | "ADD_ON";
  priceDeltaCents: number;
  defaultSelected: boolean;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: "COMBO" | "BEVERAGE" | "ADD_ON";
  priceCents: number;
  modifierGroups: Array<{
    modifierGroup: {
      id: string;
      name: string;
      active: boolean;
      options: ModifierOption[];
    };
  }>;
};

export type GroupDeliveryStatus = {
  minPaidCombos: number;
  paidComboCount: number;
  remainingPaidCombos: number;
  transportCostCents: number;
  estimatedDeliveryFeeCents: number | null;
  freeDeliveryUnlocked: boolean;
  finalized?: boolean;
  finalizedAt?: string | null;
  finalFeeCents?: number | null;
};

export type PickupEvent = {
  id: string;
  code: string;
  name: string;
  locationLabel: string;
  pickupPoint: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  timezone: string;
  startsAt: string;
  closesAt: string;
  maxCombos: number;
  reservedCombos: number;
  remainingCombos: number;
  status: "OPEN" | "SOLD_OUT";
  groupDelivery: GroupDeliveryStatus;
};

export type InventoryAvailability = {
  items: Array<{
    key: string;
    name: string;
    unit: string;
    available: number;
    lowStock: boolean;
    outOfStock: boolean;
  }>;
  productLimits: Record<string, number>;
  modifierLimits: Record<string, number>;
};

export type BurgerSelection = {
  localId: string;
  removedIds: string[];
  extraIds: string[];
};

export type CreatedOrder = {
  orderCode: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalCents: number;
  comboQuantity: number;
  reservationExpiresAt: string;
  verificationToken: string;
  pickup: {
    locationLabel: string;
    startsAt: string;
    closesAt: string;
    timezone: string;
  };
  groupDelivery: GroupDeliveryStatus;
};

export type CustomerOrderRefresh = {
  status: string;
  paymentStatus: string;
  groupDelivery: GroupDeliveryStatus;
};

export type CancelOrderResult = {
  status: string;
  paymentStatus: string;
  refundStatus: "PENDING" | "REFUNDED" | null;
};

export type PaymentResult = {
  status: string;
  paymentStatus: string;
};

export type CheckoutResult = {
  orderCode: string;
  orderStatus: string;
  paymentId: string;
  paymentStatus: string;
  provider: string;
  checkoutUrl: string;
  expiresAt: string;
};

export type CreateOrderInput = {
  pickupEventId: string;
  purchaseTermsAccepted: boolean;
  ageAuthorizationConfirmed: boolean;
  groupDeliveryTermsAccepted: boolean;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
    removedModifierOptionIds: string[];
    extraModifierOptionIds: string[];
  }>;
};
