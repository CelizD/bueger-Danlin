import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const requirements: Array<{
  file: string;
  actions: string[];
}> = [
  {
    file: "../auth/auth.service.ts",
    actions: [
      "STAFF_LOGIN_FAILED",
      "STAFF_LOGIN_LOCKED",
      "STAFF_LOGIN_MFA_REQUIRED",
      "STAFF_LOGIN_SUCCESS",
      "STAFF_LOGOUT",
    ],
  },
  {
    file: "../auth/mfa-verification.ts",
    actions: [
      "STAFF_MFA_VERIFIED",
      "STAFF_MFA_ENROLLED",
      "STAFF_MFA_RECOVERY_USED",
    ],
  },
  {
    file: "../auth/mfa.service.ts",
    actions: ["STAFF_LOGIN_SUCCESS"],
  },
  {
    file: "../admin/admin-staff.service.ts",
    actions: [
      "STAFF_USER_CREATED",
      "STAFF_USER_UPDATED",
      "STAFF_PASSWORD_RESET",
      "STAFF_MFA_RESET",
    ],
  },
  {
    file: "../inventory/inventory-item-mutations.ts",
    actions: [
      "INVENTORY_ITEM_CREATED",
      "INVENTORY_ITEM_UPDATED",
      "INVENTORY_ITEM_DELETED",
    ],
  },
  {
    file: "../admin/admin-pickup-event-mutations.ts",
    actions: [
      "PICKUP_EVENT_CREATED",
      "PICKUP_EVENT_UPDATED",
      "PICKUP_EVENT_OPENED",
    ],
  },
  {
    file: "../group-delivery/group-delivery-settlement.service.ts",
    actions: [
      "ORDER_CANCELLED_AT_PICKUP_CUTOFF",
      "GROUP_DELIVERY_FINALIZED",
    ],
  },
  {
    file: "../staff/staff-orders.service.ts",
    actions: [
      "ORDER_QR_DELIVERED",
      "ORDER_STATUS_CHANGED",
    ],
  },
  {
    file: "../orders/customer-order-cancellation.ts",
    actions: [
      "CUSTOMER_ORDER_CANCELLED",
      "CUSTOMER_ORDER_REFUNDED",
      "CUSTOMER_REFUND_REQUESTED",
    ],
  },
  {
    file: "../orders/order-create-transaction.ts",
    actions: ["ORDER_CREATED"],
  },
  {
    file: "../payments/payment-checkout.ts",
    actions: ["PAYMENT_CHECKOUT_CREATED"],
  },
  {
    file: "../payments/mock-payment-confirmation.ts",
    actions: ["PAYMENT_CONFIRMED"],
  },
  {
    file: "../payments/mercadopago-webhook-reconciliation.ts",
    actions: [
      "PAYMENT_WEBHOOK_APPLIED",
      "PAYMENT_WEBHOOK_IGNORED",
      "PAYMENT_LATE_AFTER_ORDER_CLOSED",
      "PAYMENT_CONFIRMED",
    ],
  },
];

describe("AuditLog policy", () => {
  for (const requirement of requirements) {
    it(`mantiene eventos obligatorios en ${requirement.file}`, () => {
      const path = fileURLToPath(
        new URL(requirement.file, import.meta.url),
      );
      const source = readFileSync(path, "utf8");

      for (const action of requirement.actions) {
        expect(source).toContain(`"${action}"`);
      }
    });
  }

  it("la creación de pedido no audita PII o tokens", () => {
    const path = fileURLToPath(
      new URL(
        "../orders/order-create-transaction.ts",
        import.meta.url,
      ),
    );
    const source = readFileSync(path, "utf8");
    const start = source.indexOf('action: "ORDER_CREATED"');
    const end = source.indexOf("});", start);

    expect(start).toBeGreaterThanOrEqual(0);
    const auditBlock = source.slice(start, end);

    expect(auditBlock).not.toContain("customer.name");
    expect(auditBlock).not.toContain("customer.phone");
    expect(auditBlock).not.toContain("customer.email");
    expect(auditBlock).not.toContain("verificationToken");
  });
});
