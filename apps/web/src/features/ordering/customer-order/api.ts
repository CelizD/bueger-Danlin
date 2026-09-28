import {
  API_URL,
  apiFetch,
} from "@/lib/api/browser";
import type {
  CancelOrderResult,
  CustomerOrder,
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

export async function fetchCustomerOrder(
  orderCode: string,
  orderToken: string,
) {
  const response = await apiFetch(
    API_URL +
      "/orders/" +
      encodeURIComponent(orderCode),
    {
      headers: {
        "x-order-token": orderToken,
      },
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(
        data,
        "No se pudo consultar el pedido.",
      ),
    );
  }

  return data as CustomerOrder;
}

export async function cancelCustomerOrder(
  orderCode: string,
  orderToken: string,
) {
  const response = await apiFetch(
    API_URL +
      "/orders/" +
      encodeURIComponent(orderCode) +
      "/cancel",
    {
      method: "POST",
      headers: {
        "x-order-token": orderToken,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(
        data,
        "No se pudo cancelar el pedido.",
      ),
    );
  }

  return data as CancelOrderResult;
}
