import { API_URL, apiFetch } from "@/lib/api/browser";
import type {
  DeliveryOrder,
  ScanResult,
  StaffUser,
} from "./types";

function responseMessage(
  data: { message?: string | string[] },
  fallback: string,
) {
  const message = Array.isArray(data.message)
    ? data.message.join(" ")
    : data.message;

  return message || fallback;
}

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

  const meData = await me.json();

  if (
    !me.ok ||
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
    throw new Error(
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

  const data =
    (await response.json()) as ScanResult & {
      message?: string | string[];
    };

  if (!response.ok) {
    throw new Error(
      responseMessage(
        data,
        "No se pudo validar el QR.",
      ),
    );
  }

  return data;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(
        data,
        "No se pudo marcar como entregado.",
      ),
    );
  }

  return data;
}
