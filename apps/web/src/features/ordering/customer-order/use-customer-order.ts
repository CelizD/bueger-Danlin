"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  cancelCustomerOrder,
  fetchCustomerDeliveryQr,
  fetchCustomerOrder,
  fetchCustomerOrderReceipt,
} from "./api";
import {
  cancellationNotice,
} from "./access";
import type { CustomerOrder } from "./types";

const TERMINAL_ORDER_STATUSES = new Set([
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "NO_SHOW",
]);

export function useCustomerOrder(
  orderCode: string,
) {
  const [order, setOrder] =
    useState<CustomerOrder | null>(
      null,
    );
  const [qrPayload, setQrPayload] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [canceling, setCanceling] =
    useState(false);
  const [
    downloadingReceipt,
    setDownloadingReceipt,
  ] = useState(false);
  const [error, setError] =
    useState("");
  const [notice, setNotice] =
    useState("");

  async function loadOrder(
    silent = false,
  ) {
    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const data =
        await fetchCustomerOrder(
          orderCode,
        );

      setOrder(data);

      if (
        data.paymentStatus === "PAID" &&
        !TERMINAL_ORDER_STATUSES.has(
          data.status,
        )
      ) {
        const qr =
          await fetchCustomerDeliveryQr(
            orderCode,
          );
        setQrPayload(qr.qrPayload);
      } else {
        setQrPayload("");
      }
    } catch (loadError) {
      if (!silent) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo consultar el pedido.",
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadOrder();
  }, [orderCode]);

  useEffect(() => {
    if (
      !order ||
      order.status !== "PENDING_PAYMENT" ||
      !["PENDING", "PROCESSING"].includes(
        order.paymentStatus,
      )
    ) {
      return;
    }

    const intervalId =
      window.setInterval(() => {
        void loadOrder(true);
      }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    orderCode,
    order?.status,
    order?.paymentStatus,
  ]);

  async function downloadReceipt() {
    if (!order) {
      return;
    }

    setDownloadingReceipt(true);
    setError("");

    try {
      const blob =
        await fetchCustomerOrderReceipt(
          order.orderCode,
        );
      const url =
        window.URL.createObjectURL(
          blob,
        );
      const anchor =
        document.createElement("a");

      anchor.href = url;
      anchor.download =
        "comprobante-" +
        order.orderCode +
        ".pdf";
      document.body.appendChild(
        anchor,
      );
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(
          url,
        );
      }, 0);
    } catch (receiptError) {
      setError(
        receiptError instanceof Error
          ? receiptError.message
          : "No se pudo descargar el comprobante.",
      );
    } finally {
      setDownloadingReceipt(false);
    }
  }

  async function cancelOrder() {
    const retryingRefund =
      order?.refundStatus === "PENDING";

    if (
      !order ||
      (!order.canCancel &&
        !retryingRefund)
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        retryingRefund
          ? "¿Reintentar el reembolso con el proveedor de pago?"
          : order.paymentStatus === "PAID"
            ? "¿Seguro que quieres cancelar? Se iniciará el reembolso del pago."
            : "¿Seguro que quieres cancelar? El cupo reservado se liberará.",
      );

    if (!confirmed) {
      return;
    }

    setCanceling(true);
    setError("");
    setNotice("");

    try {
      const data =
        await cancelCustomerOrder(
          order.orderCode,
        );

      setNotice(
        cancellationNotice(
          data.refundStatus,
        ),
      );

      await loadOrder();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "No se pudo cancelar el pedido.",
      );
    } finally {
      setCanceling(false);
    }
  }

  return {
    order,
    qrPayload,
    loading,
    canceling,
    downloadingReceipt,
    error,
    notice,
    downloadReceipt,
    cancelOrder,
  };
}
