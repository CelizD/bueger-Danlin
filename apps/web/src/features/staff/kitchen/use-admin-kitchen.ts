"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchKitchenOrders,
  transitionKitchenOrder,
} from "./api";
import { splitKitchenOrders } from "./selectors";
import type {
  KitchenOrder,
  StaffUser,
} from "./types";

export function useAdminKitchen() {
  const [user, setUser] =
    useState<StaffUser | null>(null);
  const [orders, setOrders] =
    useState<KitchenOrder[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [busyCode, setBusyCode] =
    useState<string | null>(null);
  const [error, setError] =
    useState("");

  async function load(
    showRefresh = false,
  ) {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const result =
        await fetchKitchenOrders();

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

  const columns = useMemo(
    () => splitKitchenOrders(orders),
    [orders],
  );

  async function transition(
    order: KitchenOrder,
    next: "preparing" | "ready",
  ) {
    setBusyCode(order.orderCode);
    setError("");

    try {
      await transitionKitchenOrder(
        order.orderCode,
        next,
      );

      await load();
    } catch (transitionError) {
      setError(
        transitionError instanceof Error
          ? transitionError.message
          : "No se pudo actualizar el pedido.",
      );
    } finally {
      setBusyCode(null);
    }
  }

  return {
    user,
    columns,
    loading,
    refreshing,
    busyCode,
    error,
    load,
    transition,
  };
}
