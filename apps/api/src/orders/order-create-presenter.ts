import { createOrderVerificationToken } from "./order-create-security.js";

export function presentCreatedOrder(
  order: {
    id: string;
    orderCode: string;
    status: string;
    paymentStatus: string;
    currency: string;
    subtotalCents: number;
    totalCents: number;
    comboQuantity: number;
    reservationExpiresAt: Date | null;
    groupDeliveryMinPaidOrdersAtOrder?: number | null;
    groupDeliveryTransportCostCentsAtOrder?: number | null;
    groupDeliveryPaidOrdersAtOrder?: number | null;
    groupDeliveryEstimatedFeeCentsAtOrder?: number | null;
    pickupEvent: {
      id: string;
      code: string;
      locationLabel: string;
      startsAt: Date;
      closesAt: Date;
      timezone: string;
    };
  },
  qrSecret: string,
) {
  return {
    orderCode: order.orderCode,
    status: order.status,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
    comboQuantity: order.comboQuantity,
    reservationExpiresAt: order.reservationExpiresAt,
    verificationToken: createOrderVerificationToken(
      qrSecret,
      order.id,
    ),
    pickup: {
      eventId: order.pickupEvent.id,
      eventCode: order.pickupEvent.code,
      locationLabel: order.pickupEvent.locationLabel,
      startsAt: order.pickupEvent.startsAt,
      closesAt: order.pickupEvent.closesAt,
      timezone: order.pickupEvent.timezone,
    },
    groupDelivery: {
      minPaidOrders:
        order.groupDeliveryMinPaidOrdersAtOrder ?? 5,
      paidOrderCount:
        order.groupDeliveryPaidOrdersAtOrder ?? 0,
      remainingPaidOrders: Math.max(
        0,
        (order.groupDeliveryMinPaidOrdersAtOrder ?? 5) -
          (order.groupDeliveryPaidOrdersAtOrder ?? 0),
      ),
      transportCostCents:
        order.groupDeliveryTransportCostCentsAtOrder ?? 0,
      estimatedDeliveryFeeCents:
        order.groupDeliveryEstimatedFeeCentsAtOrder,
      freeDeliveryUnlocked:
        (order.groupDeliveryPaidOrdersAtOrder ?? 0) >=
        (order.groupDeliveryMinPaidOrdersAtOrder ?? 5),
    },
  };
}
