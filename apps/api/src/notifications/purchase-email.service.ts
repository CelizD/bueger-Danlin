import {
  Injectable,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type {
  ReceiptOrder,
} from "../orders/customer-order-receipt.js";
import {
  buildPurchaseConfirmationEmail,
} from "./purchase-confirmation-email.template.js";
import {
  SmtpMailTransport,
} from "./smtp-mail.transport.js";

const MAX_ATTEMPTS = 5;
const CLAIM_STALE_MS =
  5 * 60 * 1000;

function safeError(error: unknown) {
  return (
    error instanceof Error
      ? error.message
      : String(error)
  )
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 240);
}

@Injectable()
export class PurchaseEmailService {
  private readonly logger =
    new Logger(
      PurchaseEmailService.name,
    );

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: SmtpMailTransport,
  ) {}

  async trySendForOrder(
    orderId: string,
  ) {
    if (!this.mail.isEnabled()) {
      return {
        sent: false,
        disabled: true,
      };
    }

    const notification =
      await this.prisma
        .emailNotification
        .findUnique({
          where: {
            orderId_type: {
              orderId,
              type:
                "PURCHASE_CONFIRMATION",
            },
          },
          select: {
            id: true,
          },
        });

    if (!notification) {
      return {
        sent: false,
        missing: true,
      };
    }

    return this.processOne(
      notification.id,
    );
  }

  async processPending(
    limit = 25,
  ) {
    if (!this.mail.isEnabled()) {
      return {
        enabled: false,
        selected: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      };
    }

    const staleBefore =
      new Date(
        Date.now() -
          CLAIM_STALE_MS,
      );

    const candidates =
      await this.prisma
        .emailNotification
        .findMany({
          where: {
            attemptCount: {
              lt: MAX_ATTEMPTS,
            },
            OR: [
              {
                status: {
                  in: [
                    "PENDING",
                    "FAILED",
                  ],
                },
              },
              {
                status:
                  "PROCESSING",
                claimedAt: {
                  lt: staleBefore,
                },
              },
            ],
          },
          orderBy: {
            createdAt: "asc",
          },
          take: Math.max(
            1,
            Math.min(limit, 100),
          ),
          select: {
            id: true,
          },
        });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (
      const candidate of
      candidates
    ) {
      const result =
        await this.processOne(
          candidate.id,
        );

      if (result.sent) {
        sent += 1;
      } else if (
        result.skipped
      ) {
        skipped += 1;
      } else if (
        result.failed
      ) {
        failed += 1;
      }
    }

    return {
      enabled: true,
      selected:
        candidates.length,
      sent,
      failed,
      skipped,
    };
  }

  private async processOne(
    notificationId: string,
  ) {
    const staleBefore =
      new Date(
        Date.now() -
          CLAIM_STALE_MS,
      );
    const now = new Date();

    const claimed =
      await this.prisma
        .emailNotification
        .updateMany({
          where: {
            id: notificationId,
            attemptCount: {
              lt: MAX_ATTEMPTS,
            },
            OR: [
              {
                status: {
                  in: [
                    "PENDING",
                    "FAILED",
                  ],
                },
              },
              {
                status:
                  "PROCESSING",
                claimedAt: {
                  lt: staleBefore,
                },
              },
            ],
          },
          data: {
            status: "PROCESSING",
            claimedAt: now,
            lastError: null,
            attemptCount: {
              increment: 1,
            },
          },
        });

    if (claimed.count !== 1) {
      return {
        sent: false,
        claimed: false,
      };
    }

    try {
      const notification =
        await this.prisma
          .emailNotification
          .findUnique({
            where: {
              id: notificationId,
            },
            include: {
              order: {
                include: {
                  customer: true,
                  pickupEvent: {
                    include: {
                      pickupPoint:
                        true,
                    },
                  },
                  items: {
                    orderBy: {
                      id: "asc",
                    },
                    include: {
                      modifiers: {
                        orderBy: {
                          id: "asc",
                        },
                      },
                    },
                  },
                  payments: {
                    orderBy: {
                      createdAt:
                        "desc",
                    },
                  },
                },
              },
            },
          });

      if (!notification) {
        return {
          sent: false,
          missing: true,
        };
      }

      const order =
        notification.order;

      if (
        order.paymentStatus !==
          "PAID" ||
        [
          "CANCELLED",
          "REFUNDED",
        ].includes(order.status)
      ) {
        await this.prisma
          .emailNotification
          .update({
            where: {
              id: notificationId,
            },
            data: {
              status: "SKIPPED",
              claimedAt: null,
              lastError:
                "Order is no longer eligible for purchase confirmation.",
            },
          });

        return {
          sent: false,
          skipped: true,
        };
      }

      const receiptOrder =
        await this.toReceiptOrder(
          order,
        );

      const message =
        buildPurchaseConfirmationEmail({
          recipient:
            notification.recipient,
          order: receiptOrder,
        });

      const result =
        await this.mail.send(
          message,
        );

      if (!result.sent) {
        await this.prisma
          .emailNotification
          .update({
            where: {
              id: notificationId,
            },
            data: {
              status: "FAILED",
              claimedAt: null,
              lastError:
                "Email notifications are disabled.",
            },
          });

        return {
          sent: false,
          failed: true,
        };
      }

      await this.prisma
        .emailNotification
        .update({
          where: {
            id: notificationId,
          },
          data: {
            status: "SENT",
            sentAt: new Date(),
            claimedAt: null,
            lastError: null,
          },
        });

      await this.prisma
        .auditLog
        .create({
          data: {
            action:
              "PURCHASE_CONFIRMATION_EMAIL_SENT",
            entityType:
              "EmailNotification",
            entityId:
              notificationId,
            after: {
              orderId:
                order.id,
              orderCode:
                order.orderCode,
              type:
                "PURCHASE_CONFIRMATION",
            },
          },
        });

      return {
        sent: true,
      };
    } catch (error) {
      const message =
        safeError(error);

      await this.prisma
        .emailNotification
        .update({
          where: {
            id: notificationId,
          },
          data: {
            status: "FAILED",
            claimedAt: null,
            lastError: message,
          },
        })
        .catch(() => undefined);

      this.logger.warn(
        "Purchase confirmation email failed for notification " +
          notificationId +
          ": " +
          message,
      );

      return {
        sent: false,
        failed: true,
      };
    }
  }

  private async toReceiptOrder(
    order: {
      id: string;
      orderCode: string;
      status: string;
      paymentStatus: string;
      currency: string;
      totalCents: number;
      comboQuantity: number;
      createdAt: Date;
      purchaseTermsVersion:
        string | null;
      purchaseTermsAcceptedAt:
        Date | null;
      groupDeliveryFinalFeeCents:
        number | null;
      pickupEventId: string;
      pickupEvent: {
        startsAt: Date;
        timezone: string;
        transportCostCents: number;
        freeDeliveryMinPaidCombos:
          number;
        groupDeliveryFinalizedAt:
          Date | null;
        groupDeliveryFinalPaidCombos:
          number | null;
        groupDeliveryFinalFreeUnlocked:
          boolean | null;
        pickupPoint: {
          name: string;
          address: string | null;
        };
      };
      items: Array<{
        productName: string;
        quantity: number;
        lineTotalCents: number;
        modifiers: Array<{
          optionName: string;
          removed: boolean;
          priceDeltaCents: number;
          quantity: number;
        }>;
      }>;
      payments: Array<{
        provider: string;
        paidAt: Date | null;
        refundedAt: Date | null;
      }>;
    },
  ): Promise<ReceiptOrder> {
    const finalized =
      !!order.pickupEvent
        .groupDeliveryFinalizedAt;

    const paidOrders = finalized
      ? []
      : await this.prisma
          .order.findMany({
            where: {
              pickupEventId:
                order.pickupEventId,
              paymentStatus:
                "PAID",
              status: {
                notIn: [
                  "CANCELLED",
                  "REFUNDED",
                ],
              },
            },
            select: {
              comboQuantity:
                true,
            },
          });

    const paidOrderCount =
      paidOrders.length;
    const paidComboCount =
      finalized
        ? order.pickupEvent
            .groupDeliveryFinalPaidCombos ??
          0
        : paidOrders.reduce(
            (
              sum,
              paidOrder,
            ) =>
              sum +
              paidOrder.comboQuantity,
            0,
          );

    const freeDeliveryUnlocked =
      finalized
        ? order.pickupEvent
            .groupDeliveryFinalFreeUnlocked ??
          false
        : paidComboCount >=
          order.pickupEvent
            .freeDeliveryMinPaidCombos;

    const estimatedDeliveryFeeCents =
      finalized
        ? order
            .groupDeliveryFinalFeeCents
        : freeDeliveryUnlocked
          ? 0
          : paidOrderCount > 0
            ? Math.ceil(
                order.pickupEvent
                  .transportCostCents /
                  paidOrderCount,
              )
            : null;

    const payment =
      order.payments[0] ?? null;

    return {
      orderCode:
        order.orderCode,
      status:
        order.status,
      paymentStatus:
        order.paymentStatus,
      currency:
        order.currency,
      totalCents:
        order.totalCents,
      comboQuantity:
        order.comboQuantity,
      createdAt:
        order.createdAt,
      purchaseTermsVersion:
        order.purchaseTermsVersion,
      purchaseTermsAcceptedAt:
        order.purchaseTermsAcceptedAt,
      payment: payment
        ? {
            provider:
              payment.provider,
            paidAt:
              payment.paidAt,
            refundedAt:
              payment.refundedAt,
          }
        : null,
      pickup: {
        startsAt:
          order.pickupEvent
            .startsAt,
        timezone:
          order.pickupEvent
            .timezone,
        pickupPoint: {
          name:
            order.pickupEvent
              .pickupPoint.name,
          address:
            order.pickupEvent
              .pickupPoint.address,
        },
      },
      groupDelivery: {
        finalized,
        freeDeliveryUnlocked,
        estimatedDeliveryFeeCents,
        finalFeeCents:
          order
            .groupDeliveryFinalFeeCents,
      },
      items:
        order.items.map(
          (item) => ({
            productName:
              item.productName,
            quantity:
              item.quantity,
            lineTotalCents:
              item.lineTotalCents,
            modifiers:
              item.modifiers.map(
                (modifier) => ({
                  optionName:
                    modifier.optionName,
                  removed:
                    modifier.removed,
                  priceDeltaCents:
                    modifier.priceDeltaCents,
                  quantity:
                    modifier.quantity,
                }),
              ),
          }),
        ),
    };
  }
}
