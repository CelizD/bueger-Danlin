"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  cancelCustomerOrder,
  fetchCustomerOrder,
  fetchCustomerOrderReceipt,
} from "./api";
import {
  cancellationNotice,
  resolveOrderAccessToken,
} from "./access";
import type { CustomerOrder } from "./types";

export function useCustomerOrder(
  orderCode: string,
) {
  const [token, setToken] =
    useState("");
  const [order, setOrder] =
    useState<CustomerOrder | null>(
      null,
    );
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
    orderToken = token,
    silent = false,
  ) {
    if (!orderToken) {
      return;
    }

    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const data =
        await fetchCustomerOrder(
          orderCode,
          orderToken,
        );

      setOrder(data);
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
    const resolvedToken =
      resolveOrderAccessToken(
        orderCode,
      );

    setToken(resolvedToken);

    if (!resolvedToken) {
      setLoading(false);
      setError(
        "Este navegador no tiene el acceso seguro de este pedido. Abre el enlace original que recibiste al comprar.",
      );
      return;
    }

    void loadOrder(resolvedToken);
  }, [orderCode]);

  useEffect(() => {
    if (
      !token ||
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
        void loadOrder(token, true);
      }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    token,
    orderCode,
    order?.status,
    order?.paymentStatus,
  ]);

  async function downloadReceipt() {
    if (!order || !token) {
      return;
    }

    setDownloadingReceipt(true);
    setError("");

    try {
      const blob =
        await fetchCustomerOrderReceipt(
          order.orderCode,
          token,
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
      !token ||
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
          token,
        );

      setNotice(
        cancellationNotice(
          data.refundStatus,
        ),
      );

      await loadOrder(token);
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
    token,
    loading,
    canceling,
    downloadingReceipt,
    error,
    notice,
    downloadReceipt,
    cancelOrder,
  };
}
