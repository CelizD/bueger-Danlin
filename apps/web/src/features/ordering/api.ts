import { apiErrorMessage, apiFetch } from "@/lib/api/browser";
import type {
  CancelOrderResult,
  CatalogProduct,
  CustomerOrderRefresh,
  CreateOrderInput,
  CreatedOrder,
  InventoryAvailability,
  PaymentResult,
  PickupEvent,
} from "./types";

export async function loadOrderingData() {
  const [catalogResponse, eventsResponse, inventoryResponse] =
    await Promise.all([
      apiFetch("/catalog", { cache: "no-store" }),
      apiFetch("/pickup-events/open", { cache: "no-store" }),
      apiFetch("/inventory/availability", { cache: "no-store" }),
    ]);

  if (!catalogResponse.ok || !inventoryResponse.ok) {
    throw new Error("No se pudo cargar el menú.");
  }

  if (!eventsResponse.ok) {
    throw new Error("No se pudieron consultar los puntos de entrega.");
  }

  const catalog = (await catalogResponse.json()) as CatalogProduct[];
  const events = (await eventsResponse.json()) as PickupEvent[];
  const inventory =
    (await inventoryResponse.json()) as InventoryAvailability;

  return {
    catalog,
    events,
    inventory,
  };
}

export async function createOrder(input: CreateOrderInput) {
  const response = await apiFetch("/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(data, "No se pudo crear el pedido."),
    );
  }

  return data as CreatedOrder;
}

export async function cancelOrder(
  orderCode: string,
  verificationToken: string,
) {
  const response = await apiFetch(
    `/orders/${encodeURIComponent(orderCode)}/cancel`,
    {
      method: "POST",
      headers: {
        "x-order-token": verificationToken,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(data, "No se pudo cancelar el pedido."),
    );
  }

  return data as CancelOrderResult;
}

export async function confirmMockOrderPayment(
  orderCode: string,
  verificationToken: string,
) {
  const response = await apiFetch(
    `/payments/mock/${encodeURIComponent(orderCode)}/confirm`,
    {
      method: "POST",
      headers: {
        "x-order-token": verificationToken,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(data, "No se pudo confirmar el pago local."),
    );
  }

  return data as PaymentResult;
}


export async function loadCustomerOrder(
  orderCode: string,
  verificationToken: string,
) {
  const response = await apiFetch(
    `/orders/${encodeURIComponent(orderCode)}`,
    {
      headers: {
        "x-order-token": verificationToken,
      },
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(data, "No se pudo actualizar el pedido."),
    );
  }

  return data as CustomerOrderRefresh;
}
