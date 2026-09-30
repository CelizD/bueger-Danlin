import { BadRequestException } from "@nestjs/common";
import {
  assertExactPickupLocation,
  buildPickupPointCode,
  type PickupPointInput,
} from "./admin-pickup-event-rules.js";

export async function ensureAdminPickupPoint(
  db: any,
  input: PickupPointInput,
) {
  const name = input.locationLabel.trim();

  assertExactPickupLocation(
    input.locationAddress,
    input.latitude,
    input.longitude,
  );

  if (!name) {
    throw new BadRequestException(
      "El nombre del punto de entrega es obligatorio.",
    );
  }

  const code = buildPickupPointCode(name);

  const existing = await db.pickupPoint.findFirst({
    where: {
      OR: [
        { code },
        {
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
      ],
    },
  });

  if (existing) {
    return db.pickupPoint.update({
      where: {
        id: existing.id,
      },
      data: {
        name,
        active: true,
        address: input.locationAddress.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
      },
    });
  }

  return db.pickupPoint.create({
    data: {
      code,
      name,
      address: input.locationAddress.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      active: true,
    },
  });
}
