import {
  API_URL,
  apiFetch,
  throwApiHttpError,
} from "@/lib/api/browser";
import type {
  DeliveryOrder,
  ScanResult,
  StaffUser,
} from "./types";

export async function fetchDeliveryOrders(): Promise<
  | { authorized: false }
  | {
      authorized: true;
      user: StaffUser;
      orders: DeliveryOrder[];
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

  if (!me.ok) {
    await throwApiHttpError(
      me,
      "No se pudo validar la sesión.",
    );
  }

  const meData = await me.json();

  if (
    !["ADMIN", "DELIVERY"].includes(
      meData.user.role,
    )
  ) {
    return { authorized: false };
  }

  const response = await apiFetch(
    API_URL + "/staff/delivery/orders",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    return { authorized: false };
  }

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudieron cargar los pedidos de entrega.",
    );
  }

  return {
    authorized: true,
    user: meData.user as StaffUser,
    orders:
      (await response.json()) as DeliveryOrder[],
  };
}

export async function scanDeliveryQr(
  qrPayload: string,
  deliveryFeeCollected = false,
) {
  const response = await apiFetch(
    API_URL + "/staff/delivery/scan",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        qrPayload,
        deliveryFeeCollected,
      }),
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo validar el QR.",
    );
  }

  return response.json() as Promise<ScanResult>;
}

export async function markDeliveryOrderDelivered(
  orderCode: string,
  deliveryFeeCollected = false,
) {
  const response = await apiFetch(
    API_URL +
      "/staff/delivery/orders/" +
      encodeURIComponent(orderCode) +
      "/delivered",
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        deliveryFeeCollected,
      }),
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo marcar como entregado.",
    );
  }

  return response.json();
}
