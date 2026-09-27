import type {
  Prisma,
  PrismaClient,
} from "../generated/prisma/client.js";

export const RETENTION = {
  pendingPaymentDays: 30,
  cancelledDays: 90,
  historicalDays: 365,
  orphanCustomerDays: 30,
  auditDays: 365,
  securityAuditDays: 180,
} as const;

export const ANONYMIZED_CUSTOMER = {
  name: "Cliente anonimizado",
  phone: "ANONYMIZED",
  email: null,
} as const;

const SECURITY_AUDIT_ACTIONS = [
  "STAFF_LOGIN_FAILED",
  "STAFF_LOGIN_LOCKED",
] as const;

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * 86_400_000);
}

export function retentionCutoffs(now = new Date()) {
  return {
    pendingPayment: daysAgo(now, RETENTION.pendingPaymentDays),
    cancelled: daysAgo(now, RETENTION.cancelledDays),
    historical: daysAgo(now, RETENTION.historicalDays),
    orphanCustomer: daysAgo(now, RETENTION.orphanCustomerDays),
    audit: daysAgo(now, RETENTION.auditDays),
    securityAudit: daysAgo(now, RETENTION.securityAuditDays),
  };
}

export function eligibleOrderWhere(
  now = new Date(),
): Prisma.OrderWhereInput {
  const cutoffs = retentionCutoffs(now);

  return {
    OR: [
      {
        status: "PENDING_PAYMENT",
        createdAt: { lt: cutoffs.pendingPayment },
      },
      {
        status: "CANCELLED",
        createdAt: { lt: cutoffs.cancelled },
      },
      {
        status: {
          in: ["DELIVERED", "REFUNDED", "NO_SHOW"],
        },
        createdAt: { lt: cutoffs.historical },
      },
    ],
  };
}

type CleanupOptions = {
  now?: Date;
  batchSize?: number;
};

export class RetentionCleanupService {
  constructor(private readonly prisma: PrismaClient) {}

  private eligibleCustomerWhere(
    now: Date,
  ): Prisma.CustomerWhereInput {
    const orderWhere = eligibleOrderWhere(now);

    return {
      AND: [
        {
          OR: [
            { name: { not: ANONYMIZED_CUSTOMER.name } },
            { phone: { not: ANONYMIZED_CUSTOMER.phone } },
            { email: { not: null } },
          ],
        },
        {
          orders: {
            some: {},
            every: orderWhere,
          },
        },
      ],
    };
  }

  async inspect(options: CleanupOptions = {}) {
    const now = options.now ?? new Date();
    const cutoffs = retentionCutoffs(now);
    const customerWhere = this.eligibleCustomerWhere(now);

    const [
      customersToAnonymize,
      orphanCustomers,
      auditLogs,
      securityAuditLogs,
      staleOperationalOrders,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: customerWhere,
      }),
      this.prisma.customer.count({
        where: {
          createdAt: { lt: cutoffs.orphanCustomer },
          orders: { none: {} },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          createdAt: { lt: cutoffs.audit },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: { in: [...SECURITY_AUDIT_ACTIONS] },
          createdAt: {
            gte: cutoffs.audit,
            lt: cutoffs.securityAudit,
          },
        },
      }),
      this.prisma.order.count({
        where: {
          status: {
            in: ["PAID", "CONFIRMED", "PREPARING", "READY"],
          },
          createdAt: { lt: cutoffs.historical },
        },
      }),
    ]);

    return {
      mode: "dry-run" as const,
      at: now.toISOString(),
      cutoffs: Object.fromEntries(
        Object.entries(cutoffs).map(([key, value]) => [
          key,
          value.toISOString(),
        ]),
      ),
      candidates: {
        customersToAnonymize,
        orphanCustomersToDelete: orphanCustomers,
        auditLogsToDelete:
          auditLogs + securityAuditLogs,
        staleOperationalOrders,
      },
    };
  }

  async run(options: CleanupOptions = {}) {
    const now = options.now ?? new Date();
    const batchSize = Math.max(
      1,
      Math.min(options.batchSize ?? 200, 1000),
    );
    const cutoffs = retentionCutoffs(now);
    let customersAnonymized = 0;
    let paymentMetadataCleared = 0;

    while (true) {
      const customers = await this.prisma.customer.findMany({
        where: this.eligibleCustomerWhere(now),
        select: {
          id: true,
          orders: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: "asc" },
        take: batchSize,
      });

      if (customers.length === 0) break;

      for (const customer of customers) {
        const orderIds = customer.orders.map(
          (order) => order.id,
        );

        const result = await this.prisma.$transaction(
          async (tx) => {
            await tx.customer.update({
              where: { id: customer.id },
              data: ANONYMIZED_CUSTOMER,
            });

            const payments =
              orderIds.length === 0
                ? { count: 0 }
                : await tx.payment.updateMany({
                    where: {
                      orderId: { in: orderIds },
                    },
                    data: {
                      metadata: {},
                    },
                  });

            return payments.count;
          },
        );

        customersAnonymized += 1;
        paymentMetadataCleared += result;
      }
    }

    const deletedSecurityAuditLogs =
      await this.prisma.auditLog.deleteMany({
        where: {
          action: { in: [...SECURITY_AUDIT_ACTIONS] },
          createdAt: { lt: cutoffs.securityAudit },
        },
      });

    const deletedOldAuditLogs =
      await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffs.audit },
        },
      });

    const deletedOrphanCustomers =
      await this.prisma.customer.deleteMany({
        where: {
          createdAt: { lt: cutoffs.orphanCustomer },
          orders: { none: {} },
        },
      });

    const staleOperationalOrders =
      await this.prisma.order.count({
        where: {
          status: {
            in: ["PAID", "CONFIRMED", "PREPARING", "READY"],
          },
          createdAt: { lt: cutoffs.historical },
        },
      });

    return {
      mode: "apply" as const,
      at: now.toISOString(),
      result: {
        customersAnonymized,
        paymentMetadataCleared,
        orphanCustomersDeleted:
          deletedOrphanCustomers.count,
        auditLogsDeleted:
          deletedSecurityAuditLogs.count +
          deletedOldAuditLogs.count,
        staleOperationalOrders,
      },
    };
  }
}
