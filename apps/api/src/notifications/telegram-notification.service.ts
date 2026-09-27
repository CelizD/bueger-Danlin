import { Injectable, Logger } from "@nestjs/common";
import { readFileSync } from "node:fs";

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

function enabled(name: string, fallback = true) {
  const value = process.env[name];

  if (value === undefined) return fallback;

  return value.trim().toLowerCase() === "true";
}

function setting(name: string) {
  const direct = process.env[name]?.trim();

  if (direct) return direct;

  const file = process.env[`${name}_FILE`]?.trim();

  if (!file) return undefined;

  try {
    const value = readFileSync(file, "utf8").trim();
    return value || undefined;
  } catch {
    return undefined;
  }
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

    this.dispatch(
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

    this.dispatch(
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

    this.dispatch(
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

    this.dispatch(
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
    this.dispatch(
      [
        "✅ Telegram conectado",
        "Burger Danlin puede enviar notificaciones.",
      ].join("\n"),
    );
  }

  private dispatch(text: string) {
    if (!enabled("TELEGRAM_NOTIFICATIONS_ENABLED", false)) {
      return;
    }

    const token = setting("TELEGRAM_BOT_TOKEN");
    const chatId = setting("TELEGRAM_CHAT_ID");

    if (!token || !chatId) {
      this.logger.warn(
        "Telegram notifications are enabled but TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.",
      );
      return;
    }

    void this.send(token, chatId, text);
  }

  private async send(
    token: string,
    chatId: string,
    text: string,
  ) {
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
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "unknown error";

      this.logger.warn(
        `Telegram notification failed: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
