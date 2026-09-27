import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import type { PaymentProviderName } from "./domain/payment-provider.types.js";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";
import { assertRealPaymentsEnabled } from "./real-payments.guard.js";

function databaseProvider(name: PaymentProviderName) {
  switch (name) {
    case "mercadopago":
      return "MERCADOPAGO" as const;
    case "stripe":
      return "STRIPE" as const;
    default:
      throw new Error(
        "The mock provider cannot create a real checkout",
      );
  }
}

function checkoutUrlFromMetadata(metadata: unknown) {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return undefined;
  }

  const checkoutUrl = (metadata as Record<string, unknown>)
    .checkoutUrl;

  return typeof checkoutUrl === "string" && checkoutUrl.length > 0
    ? checkoutUrl
    : undefined;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly telegram?: TelegramNotificationService,
    private readonly groupTelegram?: GroupTelegramNotificationService,
  ) {}

  async createCheckout(
    orderCode: string,
    verificationToken: string,
  ) {
    const orderSnapshot = await this.prisma.order.findUnique({
      where: { orderCode },
    });

    if (!orderSnapshot) {
      throw new NotFoundException("El pedido no existe.");
    }

    this.assertVerificationToken(
      orderSnapshot.verificationTokenHash,
      verificationToken,
    );

    const provider = this.paymentProviderRegistry.getConfigured();

    if (provider.name === "mock") {
      throw new ConflictException(
        "El checkout real no está disponible con el proveedor mock.",
      );
    }

    assertRealPaymentsEnabled();

    const providerForDatabase = databaseProvider(provider.name);

    const prepared = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Order"
        WHERE "orderCode" = ${orderCode}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException("El pedido no existe.");
      }

      const order = await tx.order.findUnique({
        where: { orderCode },
        include: {
          customer: true,
          pickupEvent: true,
        },
      });

      if (!order) {
        throw new NotFoundException("El pedido no existe.");
      }

      this.assertVerificationToken(
        order.verificationTokenHash,
        verificationToken,
      );

      if (order.paymentStatus === "PAID") {
        throw new ConflictException(
          "Este pedido ya fue pagado.",
        );
      }

      if (order.status !== "PENDING_PAYMENT") {
        throw new ConflictException(
          "Este pedido ya no está disponible para pago.",
        );
      }

      const now = new Date();

      if (
        order.pickupEvent.groupDeliveryFinalizedAt ||
        !["OPEN", "SOLD_OUT"].includes(order.pickupEvent.status) ||
        now >= order.pickupEvent.closesAt
      ) {
        throw new ConflictException(
          "El punto de entrega ya cerró y este pedido ya no puede pagarse.",
        );
      }

      if (
        !order.reservationExpiresAt ||
        order.reservationExpiresAt <= now
      ) {
        throw new ConflictException(
          "La reserva de 15 minutos expiró. Crea un pedido nuevo.",
        );
      }

      const idempotencyKey = `${provider.name}:${order.id}`;
      let payment = await tx.payment.findUnique({
        where: { idempotencyKey },
      });

      if (!payment) {
        payment = await tx.payment.create({
          data: {
            orderId: order.id,
            provider: providerForDatabase,
            status: "PENDING",
            amountCents: order.totalCents,
            currency: order.currency,
            idempotencyKey,
            metadata: {
              checkoutState: "PENDING",
            },
          },
        });
      }

      if (
        payment.orderId !== order.id ||
        payment.provider !== providerForDatabase ||
        payment.amountCents !== order.totalCents ||
        payment.currency !== order.currency
      ) {
        throw new ConflictException(
          "El intento de pago no coincide con el pedido.",
        );
      }

      if (payment.status === "PAID") {
        throw new ConflictException(
          "El pago ya fue aprobado y está esperando confirmación.",
        );
      }

      if (
        payment.status !== "PENDING" &&
        payment.status !== "PROCESSING"
      ) {
        throw new ConflictException(
          "El intento de pago ya no está disponible.",
        );
      }

      return {
        order: {
          id: order.id,
          orderCode: order.orderCode,
          totalCents: order.totalCents,
          currency: order.currency,
          reservationExpiresAt: order.reservationExpiresAt,
          customer: order.customer,
        },
        payment,
        idempotencyKey,
        checkoutUrl: checkoutUrlFromMetadata(payment.metadata),
      };
    });

    if (
      prepared.payment.externalId &&
      prepared.checkoutUrl
    ) {
      return {
        orderCode: prepared.order.orderCode,
        orderStatus: "PENDING_PAYMENT",
        paymentId: prepared.payment.id,
        paymentStatus: prepared.payment.status,
        provider: provider.name,
        checkoutUrl: prepared.checkoutUrl,
        expiresAt: prepared.order.reservationExpiresAt,
      };
    }

    const providerCheckout = await provider.createCheckout({
      paymentId: prepared.payment.id,
      orderCode: prepared.order.orderCode,
      amountCents: prepared.order.totalCents,
      currency: prepared.order.currency,
      description:
        `Pedido ${prepared.order.orderCode} - Burger Danlin`,
      idempotencyKey: prepared.idempotencyKey,
      expiresAt: prepared.order.reservationExpiresAt,
      customer: {
        name: prepared.order.customer.name,
        email: prepared.order.customer.email,
        phone: prepared.order.customer.phone,
      },
    });

    if (!providerCheckout.checkoutUrl) {
      throw new ConflictException(
        "El proveedor de pago no devolvió una URL de checkout.",
      );
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: prepared.payment.id },
      data: {
        externalId: providerCheckout.externalId,
        status: providerCheckout.status,
        metadata: {
          checkoutState: "CREATED",
          checkoutUrl: providerCheckout.checkoutUrl,
        },
      },
    });

    return {
      orderCode: prepared.order.orderCode,
      orderStatus: "PENDING_PAYMENT",
      paymentId: updatedPayment.id,
      paymentStatus: updatedPayment.status,
      provider: provider.name,
      checkoutUrl: providerCheckout.checkoutUrl,
      expiresAt: prepared.order.reservationExpiresAt,
    };
  }

  async confirmMockPayment(orderCode: string, verificationToken: string) {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException();
    }

    const orderSnapshot = await this.prisma.order.findUnique({
      where: { orderCode },
    });

    if (!orderSnapshot) {
      throw new NotFoundException("El pedido no existe.");
    }

    this.assertVerificationToken(
      orderSnapshot.verificationTokenHash,
      verificationToken,
    );

    let paymentNotice:
      | {
          orderCode: string;
          comboQuantity: number;
          totalCents: number;
          currency: string;
          locationLabel?: string;
          pickupEventId: string;
        }
      | undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Order"
        WHERE "orderCode" = ${orderCode}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException("El pedido no existe.");
      }

      const order = await tx.order.findUnique({
        where: { orderCode },
        include: {
          pickupEvent: true,
          customer: true,
        },
      });

      if (!order) {
        throw new NotFoundException("El pedido no existe.");
      }

      this.assertVerificationToken(
        order.verificationTokenHash,
        verificationToken,
      );

      if (order.paymentStatus === "PAID") {
        return {
          orderCode: order.orderCode,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalCents: order.totalCents,
          currency: order.currency,
          paid: true,
        };
      }

      if (order.status !== "PENDING_PAYMENT") {
        throw new ConflictException(
          "Este pedido ya no está disponible para pago.",
        );
      }

      const now = new Date();

      if (
        order.pickupEvent.groupDeliveryFinalizedAt ||
        !["OPEN", "SOLD_OUT"].includes(order.pickupEvent.status) ||
        now >= order.pickupEvent.closesAt
      ) {
        throw new ConflictException(
          "El punto de entrega ya cerró y este pedido ya no puede pagarse.",
        );
      }

      if (
        !order.reservationExpiresAt ||
        order.reservationExpiresAt <= now
      ) {
        throw new ConflictException(
          "La reserva de 15 minutos expiró. Crea un pedido nuevo.",
        );
      }

      const idempotencyKey = `mock:${order.id}`;
      const mockPaymentProvider =
        this.paymentProviderRegistry.get("mock");
      const providerPayment =
        await mockPaymentProvider.createCheckout({
          paymentId: order.id,
          orderCode: order.orderCode,
          amountCents: order.totalCents,
          currency: order.currency,
          description: `Pedido ${order.orderCode} - Burger Danlin`,
          idempotencyKey,
          expiresAt: order.reservationExpiresAt,
          customer: {
            name: order.customer.name,
            email: order.customer.email,
            phone: order.customer.phone,
          },
        });

      if (providerPayment.status !== "PAID") {
        throw new ConflictException(
          "El pago simulado no fue aprobado.",
        );
      }

      await tx.payment.upsert({
        where: { idempotencyKey },
        update: {
          status: "PAID",
          amountCents: order.totalCents,
          paidAt: now,
        },
        create: {
          orderId: order.id,
          provider: "MOCK",
          status: "PAID",
          amountCents: order.totalCents,
          currency: order.currency,
          externalId: providerPayment.externalId,
          idempotencyKey,
          paidAt: now,
          metadata: {
            environment: "local",
          },
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paymentStatus: "PAID",
          reservationExpiresAt: null,
        },
      });

      await this.inventory.commitOrder(tx, order.id);

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          from: "PENDING_PAYMENT",
          to: "PAID",
          note: "Pago local simulado confirmado.",
        },
      });

      paymentNotice = {
        orderCode: order.orderCode,
        comboQuantity: order.comboQuantity,
        totalCents: order.totalCents,
        currency: order.currency,
        locationLabel: order.pickupEvent.locationLabel,
        pickupEventId: order.pickupEvent.id,
      };

      return {
        orderCode: order.orderCode,
        status: "PAID",
        paymentStatus: "PAID",
        totalCents: order.totalCents,
        currency: order.currency,
        paid: true,
      };
    });

    if (paymentNotice) {
      this.telegram?.notifyPaymentConfirmed(paymentNotice);
      await this.groupTelegram?.observeCompleted(
        paymentNotice.pickupEventId,
      );
    }

    return result;
  }

  private assertVerificationToken(
    expectedHash: string,
    verificationToken: string,
  ) {
    const actualHash = createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    const expected = Buffer.from(expectedHash, "hex");
    const actual = Buffer.from(actualHash, "hex");

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException("Token de pedido inválido.");
    }
  }
}
