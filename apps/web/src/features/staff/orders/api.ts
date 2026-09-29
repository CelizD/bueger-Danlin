import {
  API_URL,
  apiErrorMessage,
  apiFetch,
} from "@/lib/api/browser";
import type {
  OrdersResponse,
  StaffUser,
} from "./types";

export async function fetchAdminOrders(): Promise<
  | { authorized: false }
  | {
      authorized: true;
      user: StaffUser;
      data: OrdersResponse;
    }
> {
  const meResponse = await apiFetch(
    API_URL + "/auth/me",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (meResponse.status === 401) {
    return { authorized: false };
  }

  if (!meResponse.ok) {
    throw new Error(
      "No se pudo validar la sesión.",
    );
  }

  const meData = await meResponse.json();

  const ordersResponse = await apiFetch(
    API_URL + "/admin/orders",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (
    ordersResponse.status === 401 ||
    ordersResponse.status === 403
  ) {
    return { authorized: false };
  }

  if (!ordersResponse.ok) {
    throw new Error(
      "No se pudieron cargar los pedidos.",
    );
  }

  return {
    authorized: true,
    user: meData.user as StaffUser,
    data:
      (await ordersResponse.json()) as OrdersResponse,
  };
}


export async function refundAdminLatePayment(
  orderCode: string,
) {
  const response = await apiFetch(
    API_URL +
      "/admin/orders/" +
      encodeURIComponent(orderCode) +
      "/refund-late-payment",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type":
          "application/json",
      },
      body: JSON.stringify({
        confirm: true,
      }),
    },
  );

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => null);

    throw new Error(
      apiErrorMessage(
        payload,
        "No se pudo completar el reembolso.",
      ),
    );
  }

  return response.json() as Promise<{
    orderCode: string;
    status: "REFUNDED";
    paymentStatus: "REFUNDED";
    refundStatus: "REFUNDED";
    alreadyRefunded: boolean;
  }>;
}
