const CAPACITY_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
] as const;

export async function reopenCustomerOrderCapacityIfNeeded(
  tx: any,
  pickupEventId: string,
  pickupEvent: {
    status: string;
    maxCombos: number;
    closesAt: Date;
  },
) {
  if (
    pickupEvent.status !== "SOLD_OUT" ||
    pickupEvent.closesAt <= new Date()
  ) {
    return;
  }

  const capacity = await tx.order.aggregate({
    where: {
      pickupEventId,
      OR: [
        { status: { in: [...CAPACITY_STATUSES] } },
        {
          status: "PENDING_PAYMENT",
          reservationExpiresAt: { gt: new Date() },
        },
      ],
    },
    _sum: { comboQuantity: true },
  });

  if (
    (capacity._sum.comboQuantity ?? 0) <
    pickupEvent.maxCombos
  ) {
    await tx.pickupEvent.update({
      where: { id: pickupEventId },
      data: { status: "OPEN" },
    });
  }
}
