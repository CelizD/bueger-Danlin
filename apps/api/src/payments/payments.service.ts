import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
  ) {}

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

    return this.prisma.$transaction(async (tx) => {
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

      return {
        orderCode: order.orderCode,
        status: "PAID",
        paymentStatus: "PAID",
        totalCents: order.totalCents,
        currency: order.currency,
        paid: true,
      };
    });
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
