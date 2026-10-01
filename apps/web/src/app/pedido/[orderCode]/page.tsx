"use client";

import { CustomerOrderCancelCard } from "@/features/ordering/components/customer-order-cancel-card";
import { CustomerOrderItems } from "@/features/ordering/components/customer-order-items";
import { CustomerOrderSummary } from "@/features/ordering/components/customer-order-summary";
import { GroupDeliveryProgress } from "@/features/ordering/components/group-delivery-progress";
import { CUSTOMER_ORDER_STATUS_LABELS } from "@/features/ordering/customer-order/config";
import { useCustomerOrder } from "@/features/ordering/customer-order/use-customer-order";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
} from "lucide-react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

export default function CustomerOrderPage() {
  const params =
    useParams<{
      orderCode: string;
    }>();

  const orderCode =
    decodeURIComponent(
      params.orderCode ?? "",
    ).toUpperCase();

  const {
    order,
    qrPayload,
    loading,
    canceling,
    downloadingReceipt,
    error,
    notice,
    downloadReceipt,
    cancelOrder,
  } = useCustomerOrder(orderCode);

  if (loading) {
    return (
      <main className="customer-order-shell">
        <div
          className="customer-order-loading"
          role="status"
          aria-live="polite"
        >
          Consultando pedido…
        </div>
      </main>
    );
  }

  return (
    <main className="customer-order-shell">
      <div className="customer-order-page">
        <a
          href="/"
          className="customer-order-back"
        >
          <ArrowLeft size={16} />
          Volver al menú
        </a>

        {error && (
          <div
            className="alert"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        {order && (
          <>
            <header className="customer-order-header">
              <div>
                <p className="eyebrow">
                  Mi pedido
                </p>
                <h1>
                  {order.orderCode}
                </h1>
                <p>
                  Consulta el estado, la
                  entrega y las opciones
                  disponibles para este
                  pedido.
                </p>
              </div>

              <span
                className={
                  "customer-order-status status-" +
                  order.status.toLowerCase()
                }
              >
                {CUSTOMER_ORDER_STATUS_LABELS[
                  order.status
                ] ?? order.status}
              </span>
            </header>

            {notice && (
              <div
                className="customer-cancel-success"
                role="status"
                aria-live="polite"
              >
                <CheckCircle2
                  size={18}
                  aria-hidden="true"
                />
                {notice}
              </div>
            )}

            <div className="customer-order-actions">
              <button
                type="button"
                className="customer-receipt-button"
                onClick={() => {
                  void downloadReceipt();
                }}
                disabled={
                  downloadingReceipt
                }
              >
                <Download
                  size={16}
                  aria-hidden="true"
                />
                {downloadingReceipt
                  ? "Generando comprobante…"
                  : "Descargar comprobante PDF"}
              </button>
            </div>

            <CustomerOrderSummary
              order={order}
            />

            <GroupDeliveryProgress
              group={
                order.groupDelivery
              }
              pointName={
                order.pickup
                  .pickupPoint.name
              }
              paymentStatus={
                order.paymentStatus
              }
            />

            {qrPayload &&
              order.paymentStatus ===
                "PAID" &&
              ![
                "DELIVERED",
                "CANCELLED",
                "REFUNDED",
                "NO_SHOW",
              ].includes(
                order.status,
              ) && (
                <div className="customer-qr-card">
                  <div className="customer-qr-copy">
                    <p className="eyebrow">
                      Código de entrega
                    </p>
                    <h2>
                      Presenta este QR
                    </h2>
                    <p>
                      Muéstralo al momento de recoger tu pedido. El personal lo escaneará para confirmar la entrega.
                    </p>
                  </div>

                  <div
                    className="customer-qr-frame"
                    aria-label="QR de entrega"
                  >
                    <QRCodeSVG
                      value={qrPayload}
                      size={220}
                      level="H"
                      marginSize={2}
                      title={`Pedido ${order.orderCode}`}
                    />
                  </div>

                  <div className="customer-qr-code">
                    <span>Pedido</span>
                    <strong>
                      {order.orderCode}
                    </strong>
                  </div>

                  <p className="customer-qr-warning">
                    No compartas este QR públicamente. Funciona como comprobante para retirar tu pedido.
                  </p>
                </div>
              )}

            <CustomerOrderItems
              order={order}
            />

            <CustomerOrderCancelCard
              order={order}
              canceling={canceling}
              onCancel={() => {
                void cancelOrder();
              }}
            />

            <p className="technical-note">
              Pago:{" "}
              {order.paymentStatus}
              {order.refundStatus ===
                "PENDING" &&
                " · Reembolso en proceso"}
              {order.refundStatus ===
                "REFUNDED" &&
                " · Reembolso completado"}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
