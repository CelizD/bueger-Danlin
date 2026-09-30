import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

export type NormalizedCreateOrderRequest = {
  pickupEventId: string;
  purchaseTermsAccepted: true;
  ageAuthorizationConfirmed: true;
  groupDeliveryTermsAccepted: true;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  items: Array<{
    productId: string;
    quantity: number;
    removedModifierOptionIds: string[];
    extraModifierOptionIds: string[];
  }>;
};

export function prepareCreateOrderRequest(
  dto: CreateOrderDto,
  idempotencyKey: string,
) {
  const requestKey = idempotencyKey.trim();

  if (
    requestKey.length < 16 ||
    requestKey.length > 128
  ) {
    throw new BadRequestException(
      "Idempotency-Key debe tener entre 16 y 128 caracteres.",
    );
  }

  if (dto.purchaseTermsAccepted !== true) {
    throw new BadRequestException(
      "Debes aceptar los términos y condiciones de compra antes de continuar.",
    );
  }

  if (dto.ageAuthorizationConfirmed !== true) {
    throw new BadRequestException(
      "Debes confirmar que eres mayor de edad o que cuentas con autorización de tu madre, padre o tutor.",
    );
  }

  if (dto.groupDeliveryTermsAccepted !== true) {
    throw new BadRequestException(
      "Debes aceptar las condiciones de entrega grupal antes de continuar.",
    );
  }

  const normalizedRequest: NormalizedCreateOrderRequest = {
    pickupEventId: dto.pickupEventId,
    purchaseTermsAccepted: true,
    ageAuthorizationConfirmed: true,
    groupDeliveryTermsAccepted: true,
    customer: {
      name: dto.customer.name.trim(),
      phone: dto.customer.phone,
      email:
        dto.customer.email?.trim().toLowerCase() ?? null,
    },
    items: dto.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      removedModifierOptionIds: [
        ...(item.removedModifierOptionIds ?? []),
      ].sort(),
      extraModifierOptionIds: [
        ...(item.extraModifierOptionIds ?? []),
      ].sort(),
    })),
  };

  const requestHash = createHash("sha256")
    .update(JSON.stringify(normalizedRequest))
    .digest("hex");

  return {
    requestKey,
    requestHash,
    normalizedRequest,
  };
}
