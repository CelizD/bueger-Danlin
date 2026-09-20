import { API_URL, apiErrorMessage } from "@/lib/api/browser";
import type {
  CancelOrderResult,
  CatalogProduct,
  CreateOrderInput,
  CreatedOrder,
  InventoryAvailability,
  PaymentResult,
  PickupEvent,
} from "./types";

export async function loadOrderingData() {
  const [catalogResponse, eventResponse, inventoryResponse] =
    await Promise.all([
      fetch(`${API_URL}/catalog`, { cache: "no-store" }),
      fetch(`${API_URL}/pickup-events/current`, { cache: "no-store" }),
      fetch(`${API_URL}/inventory/availability`, { cache: "no-store" }),
    ]);

  if (!catalogResponse.ok || !inventoryResponse.ok) {
    throw new Error("No se pudo cargar el menú.");
  }

  if (!eventResponse.ok && eventResponse.status !== 404) {
    throw new Error("No se pudo consultar la fecha de entrega.");
  }

  const catalog = (await catalogResponse.json()) as CatalogProduct[];
  const event =
    eventResponse.status === 404
      ? null
      : ((await eventResponse.json()) as PickupEvent);
  const inventory =
    (await inventoryResponse.json()) as InventoryAvailability;

  return {
    catalog,
    event,
    inventory,
  };
}

export async function createOrder(input: CreateOrderInput) {
  const response = await fetch(`${API_URL}/orders`, {
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
  const response = await fetch(
    `${API_URL}/orders/${encodeURIComponent(orderCode)}/cancel`,
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
  const response = await fetch(
    `${API_URL}/payments/mock/${encodeURIComponent(orderCode)}/confirm`,
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
