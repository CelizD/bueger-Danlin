export type CustomerOrder = {
  orderCode: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalCents: number;
  comboQuantity: number;
  createdAt: string;
  cancelledAt: string | null;
  canCancel: boolean;
  cancellationDeadline: string;
  refundStatus: "PENDING" | "REFUNDED" | null;
  pickup: {
    locationLabel: string;
    startsAt: string;
    closesAt: string;
    timezone: string;
    pickupPoint: {
      code: string;
      name: string;
      address: string | null;
    };
  };
  groupDelivery: {
    minPaidOrders: number;
    paidOrderCount: number;
    remainingPaidOrders: number;
    transportCostCents: number;
    estimatedDeliveryFeeCents: number | null;
    freeDeliveryUnlocked: boolean;
    finalized: boolean;
    finalizedAt: string | null;
    finalFeeCents: number | null;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    lineTotalCents: number;
    modifiers: Array<{
      id: string;
      optionName: string;
      removed: boolean;
      priceDeltaCents: number;
    }>;
  }>;
};

export type CancelOrderResult = {
  refundStatus: "PENDING" | "REFUNDED" | null;
};
