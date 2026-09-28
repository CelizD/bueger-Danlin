import {
  API_URL,
  apiFetch,
} from "@/lib/api/browser";
import type {
  DashboardData,
  StaffUser,
} from "./types";

export async function fetchAdminDashboard(
  pickupEventId: string,
): Promise<
  | { authorized: false }
  | {
      authorized: true;
      user: StaffUser;
      data: DashboardData;
    }
> {
  const me = await apiFetch(
    API_URL + "/auth/me",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (me.status === 401) {
    return { authorized: false };
  }

  const meData = await me.json();

  if (
    !me.ok ||
    meData.user.role !== "ADMIN"
  ) {
    return { authorized: false };
  }

  const query =
    pickupEventId === "ALL"
      ? ""
      : "?pickupEventId=" +
        encodeURIComponent(
          pickupEventId,
        );

  const response = await apiFetch(
    API_URL +
      "/admin/dashboard" +
      query,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      "No se pudieron cargar las métricas de ventas.",
    );
  }

  return {
    authorized: true,
    user: meData.user as StaffUser,
    data:
      (await response.json()) as DashboardData,
  };
}
