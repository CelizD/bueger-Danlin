import {
  API_URL,
  apiFetch,
  throwApiHttpError,
} from "@/lib/api/browser";
import type {
  KitchenOrder,
  StaffUser,
} from "./types";

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

  if (!me.ok) {
    await throwApiHttpError(
      me,
      "No se pudo validar la sesión.",
    );
  }

  const meData = await me.json();

  if (meData.user.role !== "KITCHEN") {
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
    await throwApiHttpError(
      response,
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

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo actualizar el pedido.",
    );
  }

  return response.json();
}
