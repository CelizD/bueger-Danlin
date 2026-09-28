"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchDeliveryOrders,
  markDeliveryOrderDelivered,
  scanDeliveryQr,
} from "./api";
import {
  filterDeliveryOrders,
  splitDeliveryOrders,
} from "./selectors";
import type {
  DeliveryOrder,
  DeliveryScanStatus,
  StaffUser,
} from "./types";
import { useDeliveryScanner } from "./use-delivery-scanner";

export function useAdminDelivery() {
  const [user, setUser] =
    useState<StaffUser | null>(null);
  const [orders, setOrders] =
    useState<DeliveryOrder[]>([]);
  const [query, setQuery] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [busyCode, setBusyCode] =
    useState<string | null>(null);
  const [error, setError] =
    useState("");
  const [
    scanStatus,
    setScanStatus,
  ] =
    useState<DeliveryScanStatus | null>(
      null,
    );

  async function load(
    showRefresh = false,
  ) {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const result =
        await fetchDeliveryOrders();

      if (!result.authorized) {
        window.location.replace(
          "/admin/login",
        );
        return;
      }

      setUser(result.user);
      setOrders(result.orders);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los pedidos.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();

    const interval =
      window.setInterval(
        () => void load(),
        15_000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, []);

  const filtered = useMemo(
    () =>
      filterDeliveryOrders(
        orders,
        query,
      ),
    [orders, query],
  );

  const { ready, delivered } =
    useMemo(
      () =>
        splitDeliveryOrders(
          filtered,
        ),
      [filtered],
    );

  async function processQr(
    qrPayload: string,
  ) {
    setError("");
    setScanStatus(null);

    try {
      const data =
        await scanDeliveryQr(
          qrPayload,
        );

      setScanStatus({
        kind: data.alreadyDelivered
          ? "warning"
          : "success",
        orderCode: data.orderCode,
        message:
          data.alreadyDelivered
            ? "Este QR ya había sido utilizado. El pedido ya está entregado."
            : `Entrega confirmada para ${data.customer.name}.`,
      });

      setQuery(data.orderCode);
      await load();
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "No se pudo validar el QR.",
      );
    }
  }

  async function markDelivered(
    order: DeliveryOrder,
  ) {
    setBusyCode(order.orderCode);
    setError("");
    setScanStatus(null);

    try {
      await markDeliveryOrderDelivered(
        order.orderCode,
      );

      setScanStatus({
        kind: "success",
        orderCode: order.orderCode,
        message:
          `Entrega manual confirmada para ${order.customer.name}.`,
      });

      await load();
    } catch (deliveryError) {
      setError(
        deliveryError instanceof Error
          ? deliveryError.message
          : "No se pudo marcar como entregado.",
      );
    } finally {
      setBusyCode(null);
    }
  }

  const scanner =
    useDeliveryScanner(
      processQr,
      setError,
    );

  return {
    user,
    query,
    loading,
    refreshing,
    busyCode,
    error,
    scanStatus,
    ready,
    delivered,
    load,
    setQuery,
    markDelivered,
    ...scanner,
  };
}
