"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchAdminOrders } from "./api";
import { filterAdminOrders } from "./selectors";
import type {
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
    filteredOrders,
    load,
    setQuery,
    setStatus,
    selectEvent,
    toggleExpanded,
  };
}
