import {
  API_URL,
  apiFetch,
  throwApiHttpError,
} from "@/lib/api/browser";
import type {
  CancelOrderResult,
  CustomerOrder,
} from "./types";

export async function fetchCustomerOrder(
  orderCode: string,
) {
  const response = await apiFetch(
    API_URL +
      "/orders/" +
      encodeURIComponent(orderCode),
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo consultar el pedido.",
    );
  }

  return response.json() as Promise<CustomerOrder>;
}

export async function fetchCustomerDeliveryQr(
  orderCode: string,
) {
  const response = await apiFetch(
    API_URL +
      "/orders/" +
      encodeURIComponent(orderCode) +
      "/delivery-qr",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo generar el QR de entrega.",
    );
  }

  return response.json() as Promise<{
    orderCode: string;
    qrPayload: string;
  }>;
}

export async function cancelCustomerOrder(
  orderCode: string,
) {
  const response = await apiFetch(
    API_URL +
      "/orders/" +
      encodeURIComponent(orderCode) +
      "/cancel",
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo cancelar el pedido.",
    );
  }

  return response.json() as Promise<CancelOrderResult>;
}

export async function fetchCustomerOrderReceipt(
  orderCode: string,
) {
  const response = await apiFetch(
    API_URL +
      "/orders/" +
      encodeURIComponent(orderCode) +
      "/receipt",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo descargar el comprobante.",
    );
  }

  return response.blob();
}
