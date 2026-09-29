import {
  money,
  pickupQrPayload,
} from "@/features/ordering/formatters";
import { GroupDeliveryProgress } from "@/features/ordering/components/group-delivery-progress";
import type { CreatedOrder } from "@/features/ordering/types";
import { QRCodeSVG } from "qrcode.react";

type OrderConfirmationProps = {
  order: CreatedOrder;
  error: string;
  cancelMessage: string;
  paying: boolean;
  canceling: boolean;
  paymentProvider: string;
  onConfirmPayment: () => void;
  onCancel: () => void;
};

export function OrderConfirmation({
  order,
  error,
  cancelMessage,
  paying,
  canceling,
  paymentProvider,
  onConfirmPayment,
  onCancel,
}: OrderConfirmationProps) {
  const isPaid = order.paymentStatus === "PAID";
  const isCancelled =
    order.status === "CANCELLED" || order.status === "REFUNDED";
  const cancellationOpen =
    !isCancelled && new Date() < new Date(order.pickup.closesAt);

  return (
    <main className="shell">
      <section className="confirmation">
        <p className="eyebrow">
          {isCancelled
            ? order.status === "REFUNDED"
              ? "Pedido reembolsado"
              : "Pedido cancelado"
            : isPaid
              ? "Pago confirmado"
              : "Pedido reservado"}
        </p>

        <h1>{order.orderCode}</h1>

        <p className="lead">
          {isCancelled
            ? order.status === "REFUNDED"
              ? "Tu pedido fue cancelado y el reembolso quedó completado."
              : "Tu pedido fue cancelado y el cupo quedó liberado."
            : isPaid
              ? "Tu pago quedó confirmado y el pedido puede continuar con cocina y entrega."
              : `Reservamos ${order.comboQuantity} combo(s) durante 15 minutos mientras completas el pago.`}
        </p>

        {error && (
          <div className="alert" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {cancelMessage && (
          <div
            className="customer-cancel-success"
            role="status"
            aria-live="polite"
          >
            {cancelMessage}
          </div>
        )}

        <div className="confirmation-grid">
          <div>
            <span>Total</span>
            <strong>{money.format(order.totalCents / 100)}</strong>
          </div>
          <div>
            <span>Entrega</span>
            <strong>{order.pickup.locationLabel}</strong>
            <small>
              {new Intl.DateTimeFormat("es-MX", {
                timeZone: order.pickup.timezone,
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(order.pickup.startsAt))}
            </small>
          </div>
        </div>

        <GroupDeliveryProgress
          group={order.groupDelivery}
          pointName={order.pickup.locationLabel}
          paymentStatus={order.paymentStatus}
        />

        {!isPaid && !isCancelled && (
          <button
            className="primary-button payment-button"
            type="button"
            onClick={onConfirmPayment}
            disabled={paying}
          >
            {paymentProvider === "mercadopago"
              ? paying
                ? "Abriendo Mercado Pago…"
                : "Pagar con Mercado Pago"
              : paying
                ? "Confirmando pago…"
                : "Simular pago local"}
          </button>
        )}

        {isPaid && !isCancelled && (
          <>
            <div className="paid-badge">Pago aprobado</div>

            <div className="customer-qr-card">
              <div className="customer-qr-copy">
                <p className="eyebrow">Código de entrega</p>
                <h2>Presenta este QR</h2>
                <p>
                  Muéstralo al momento de recoger tu pedido. El personal lo
                  escaneará para confirmar la entrega.
                </p>
              </div>

              <div className="customer-qr-frame" aria-label="QR de entrega">
                <QRCodeSVG
                  value={pickupQrPayload(order)}
                  size={220}
                  level="H"
                  marginSize={2}
                  title={`Pedido ${order.orderCode}`}
                />
              </div>

              <div className="customer-qr-code">
                <span>Pedido</span>
                <strong>{order.orderCode}</strong>
              </div>

              <p className="customer-qr-warning">
                No compartas este QR públicamente. Funciona como comprobante
                para retirar tu pedido.
              </p>
            </div>
          </>
        )}

        <div className="customer-order-actions">
          {!isCancelled && cancellationOpen && (
            <button
              className="customer-cancel-button"
              type="button"
              onClick={onCancel}
              disabled={canceling}
            >
              {canceling
                ? "Cancelando…"
                : isPaid
                  ? "Cancelar e iniciar reembolso"
                  : "Cancelar pedido"}
            </button>
          )}

          <a
            className="customer-manage-link"
            href={`/pedido/${encodeURIComponent(order.orderCode)}#token=${encodeURIComponent(order.verificationToken)}`}
          >
            Administrar mi pedido
          </a>
        </div>

        <p className="technical-note">
          Estado: {order.status} · Pago: {order.paymentStatus}
          {!isCancelled && (
            <>
              {" "}· Cancelaciones hasta{" "}
              {new Intl.DateTimeFormat("es-MX", {
                timeZone: order.pickup.timezone,
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(order.pickup.closesAt))}
            </>
          )}
        </p>
      </section>
    </main>
  );
}
