import { Injectable, Logger } from "@nestjs/common";
import { readSetting } from "../config/secret-setting.js";

type OrderNotice = {
  orderCode: string;
  comboQuantity: number;
  totalCents: number;
  currency: string;
  locationLabel?: string;
};

type StatusNotice = OrderNotice & {
  status: "PREPARING" | "READY" | "DELIVERED";
};

type CancellationNotice = OrderNotice & {
  refundStatus?: "PENDING" | "REFUNDED" | null;
};

export type GroupCompletedNotice = {
  locationLabel: string;
  paidComboCount: number;
  minPaidCombos: number;
};

export type GroupClosedNotice = {
  locationLabel: string;
  paidComboCount: number;
  minPaidCombos: number;
  transportCostCents: number;
  assignedCents: number;
  freeDeliveryUnlocked: boolean;
  cancelledPendingOrders: number;
};

function enabled(name: string, fallback = true) {
  const value = process.env[name];

  if (value === undefined) return fallback;

  return value.trim().toLowerCase() === "true";
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(
    TelegramNotificationService.name,
  );

  notifyOrderCreated(order: OrderNotice) {
    if (!enabled("TELEGRAM_NOTIFY_NEW_ORDER")) return;

    void this.dispatch(
      [
        "🍔 Nuevo pedido",
        `Pedido: ${order.orderCode}`,
        `Combos: ${order.comboQuantity}`,
        `Total: ${money(order.totalCents, order.currency)}`,
        order.locationLabel
          ? `Entrega: ${order.locationLabel}`
          : undefined,
        "Estado: pendiente de pago",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  notifyPaymentConfirmed(order: OrderNotice) {
    if (!enabled("TELEGRAM_NOTIFY_PAYMENT")) return;

    void this.dispatch(
      [
        "💳 Pago confirmado",
        `Pedido: ${order.orderCode}`,
        `Combos: ${order.comboQuantity}`,
        `Total: ${money(order.totalCents, order.currency)}`,
        "Estado: pagado",
      ].join("\n"),
    );
  }

  notifyStatusChanged(order: StatusNotice) {
    if (
      order.status === "PREPARING" &&
      !enabled("TELEGRAM_NOTIFY_PREPARING", false)
    ) {
      return;
    }

    if (
      order.status === "READY" &&
      !enabled("TELEGRAM_NOTIFY_READY")
    ) {
      return;
    }

    if (
      order.status === "DELIVERED" &&
      !enabled("TELEGRAM_NOTIFY_DELIVERED")
    ) {
      return;
    }

    const heading =
      order.status === "PREPARING"
        ? "👨‍🍳 Pedido en preparación"
        : order.status === "READY"
          ? "✅ Pedido listo"
          : "📦 Pedido entregado";

    void this.dispatch(
      [
        heading,
        `Pedido: ${order.orderCode}`,
        `Combos: ${order.comboQuantity}`,
        `Total: ${money(order.totalCents, order.currency)}`,
      ].join("\n"),
    );
  }

  notifyCancelled(order: CancellationNotice) {
    if (!enabled("TELEGRAM_NOTIFY_CANCELLED")) return;

    const heading =
      order.refundStatus === "REFUNDED"
        ? "↩️ Pedido cancelado y reembolsado"
        : order.refundStatus === "PENDING"
          ? "⚠️ Pedido cancelado — reembolso pendiente"
          : "❌ Pedido cancelado";

    void this.dispatch(
      [
        heading,
        `Pedido: ${order.orderCode}`,
        `Combos: ${order.comboQuantity}`,
        `Total: ${money(order.totalCents, order.currency)}`,
        order.locationLabel
          ? `Entrega: ${order.locationLabel}`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  notifyTest() {
    void this.dispatch(
      [
        "✅ Telegram conectado",
        "Burger Danlin puede enviar notificaciones.",
      ].join("\n"),
    );
  }

  async notifyGroupCompleted(
    group: GroupCompletedNotice,
  ) {
    if (!enabled("TELEGRAM_NOTIFY_GROUP_COMPLETED")) {
      return false;
    }

    return this.dispatch(
      [
        "🎉 Grupo completado",
        `Punto: ${group.locationLabel}`,
        `Meta: ${group.paidComboCount} de ${group.minPaidCombos} combos pagados`,
        "Envío gratis desbloqueado ✅",
      ].join("\n"),
    );
  }

  async notifyGroupClosed(group: GroupClosedNotice) {
    if (!enabled("TELEGRAM_NOTIFY_GROUP_CLOSED")) {
      return false;
    }

    const deliveryLine = group.freeDeliveryUnlocked
      ? "Envío: gratis confirmado ✅"
      : `Envío final a cobrar: ${money(
          group.assignedCents,
          "MXN",
        )}`;

    return this.dispatch(
      [
        "🔒 Punto de entrega cerrado",
        `Punto: ${group.locationLabel}`,
        `Combos pagados: ${group.paidComboCount} de ${group.minPaidCombos}`,
        `Traslado: ${money(group.transportCostCents, "MXN")}`,
        deliveryLine,
        `Pedidos sin pagar cancelados: ${group.cancelledPendingOrders}`,
        "Estado: cargos de envío congelados",
      ].join("\n"),
    );
  }

  private async dispatch(text: string): Promise<boolean> {
    if (!enabled("TELEGRAM_NOTIFICATIONS_ENABLED", false)) {
      return false;
    }

    const token = readSetting("TELEGRAM_BOT_TOKEN");
    const chatId = readSetting("TELEGRAM_CHAT_ID");

    if (!token || !chatId) {
      this.logger.warn(
        "Telegram notifications are enabled but TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.",
      );
      return false;
    }

    return this.send(token, chatId, text);
  }

  private async send(
    token: string,
    chatId: string,
    text: string,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      5_000,
    );

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: text.slice(0, 4096),
            disable_web_page_preview: true,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Telegram sendMessage failed with status ${response.status}.`,
        );
        return false;
      }

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "unknown error";

      this.logger.warn(
        `Telegram notification failed: ${message}`,
      );
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
