"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchAdminOrders,
  refundAdminLatePayment,
} from "./api";
import { filterAdminOrders } from "./selectors";
import type {
  AdminOrder,
  OrdersResponse,
  StaffUser,
} from "./types";

export function useAdminOrders() {
  const [user, setUser] =
    useState<StaffUser | null>(null);
  const [data, setData] =
    useState<OrdersResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState("ALL");
  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState<string | null>(null);
  const [expanded, setExpanded] =
    useState<string | null>(null);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  const [
    refundingOrderCode,
    setRefundingOrderCode,
  ] = useState<string | null>(null);

  async function load(
    showRefreshing = false,
  ) {
    if (showRefreshing) {
      setRefreshing(true);
    }

    try {
      const result =
        await fetchAdminOrders();

      if (!result.authorized) {
        window.location.replace(
          "/admin/login",
        );
        return;
      }

      setUser(result.user);
      setData(result.data);
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
  }, []);

  const filteredOrders = useMemo(
    () =>
      filterAdminOrders(
        data,
        query,
        status,
        selectedEventId,
      ),
    [
      data,
      query,
      status,
      selectedEventId,
    ],
  );

  function selectEvent(
    eventId: string | null,
  ) {
    setSelectedEventId(eventId);
    setExpanded(null);
  }

  function toggleExpanded(
    orderId: string,
  ) {
    setExpanded((current) =>
      current === orderId
        ? null
        : orderId,
    );
  }

  async function refundLatePayment(
    order: AdminOrder,
  ) {
    const issue = order.refundIssue;

    if (!issue) return;

    const amount =
      new Intl.NumberFormat(
        "es-MX",
        {
          style: "currency",
          currency: "MXN",
        },
      ).format(
        issue.amountCents / 100,
      );

    if (
      !window.confirm(
        `¿Confirmas reembolsar ${amount} del pedido ${order.orderCode}? Esta acción se enviará al proveedor de pago.`,
      )
    ) {
      return;
    }

    setRefundingOrderCode(
      order.orderCode,
    );
    setError("");
    setSuccess("");

    try {
      await refundAdminLatePayment(
        order.orderCode,
      );
      await load(true);
      setExpanded(order.id);
      setSuccess(
        `Reembolso de ${order.orderCode} completado correctamente.`,
      );
    } catch (refundError) {
      setError(
        refundError instanceof Error
          ? refundError.message
          : "No se pudo completar el reembolso.",
      );
    } finally {
      setRefundingOrderCode(null);
    }
  }

  return {
    user,
    data,
    loading,
    refreshing,
    query,
    status,
    selectedEventId,
    expanded,
    error,
    success,
    refundingOrderCode,
    filteredOrders,
    load,
    setQuery,
    setStatus,
    selectEvent,
    toggleExpanded,
    refundLatePayment,
  };
}
