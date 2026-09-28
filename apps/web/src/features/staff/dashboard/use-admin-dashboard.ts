"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchAdminDashboard } from "./api";
import type {
  DashboardData,
  StaffUser,
} from "./types";

export function useAdminDashboard() {
  const [user, setUser] =
    useState<StaffUser | null>(null);
  const [data, setData] =
    useState<DashboardData | null>(
      null,
    );
  const [
    selectedEventId,
    setSelectedEventId,
  ] = useState("ALL");
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");

  async function load(
    pickupEventId =
      selectedEventId,
    showRefresh = false,
  ) {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const result =
        await fetchAdminDashboard(
          pickupEventId,
        );

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
          : "No se pudo cargar el dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load("ALL");
  }, []);

  const maxExtraQuantity =
    useMemo(
      () =>
        Math.max(
          1,
          ...(data?.topExtras.map(
            (extra) =>
              extra.quantity,
          ) ?? [1]),
        ),
      [data],
    );

  const maxEventRevenue =
    useMemo(
      () =>
        Math.max(
          1,
          ...(data?.salesByEvent.map(
            (event) =>
              event.revenueCents,
          ) ?? [1]),
        ),
      [data],
    );

  async function changeEvent(
    value: string,
  ) {
    setSelectedEventId(value);
    setLoading(true);
    await load(value);
  }

  return {
    user,
    data,
    selectedEventId,
    loading,
    refreshing,
    error,
    maxExtraQuantity,
    maxEventRevenue,
    load,
    changeEvent,
  };
}
