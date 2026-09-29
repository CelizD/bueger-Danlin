import {
  API_URL,
  apiFetch,
} from "@/lib/api/browser";
import type {
  KitchenOrder,
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

export async function fetchKitchenOrders(): Promise<
  | { authorized: false }
  | {
      authorized: true;
      user: StaffUser;
      orders: KitchenOrder[];
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
    !["ADMIN", "KITCHEN"].includes(
      meData.user.role,
    )
  ) {
    return { authorized: false };
  }

  const response = await apiFetch(
    API_URL + "/staff/kitchen/orders",
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
      "No se pudieron cargar los pedidos de cocina.",
    );
  }

  return {
    authorized: true,
    user: meData.user as StaffUser,
    orders:
      (await response.json()) as KitchenOrder[],
  };
}

export async function transitionKitchenOrder(
  orderCode: string,
  next: "preparing" | "ready",
) {
  const response = await apiFetch(
    API_URL +
      "/staff/kitchen/orders/" +
      encodeURIComponent(orderCode) +
      "/" +
      next,
    {
      method: "PATCH",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(
        data,
        "No se pudo actualizar el pedido.",
      ),
    );
  }

  return data;
}
