import {
  API_URL,
  apiFetch,
} from "@/lib/api/browser";
import type {
  CreateInventoryForm,
  InventoryDraft,
  InventoryItem,
  StaffUser,
} from "./types";
import { parseInventoryValues } from "./validation";

function responseMessage(
  data: { message?: string | string[] },
) {
  return Array.isArray(data.message)
    ? data.message.join(" ")
    : data.message;
}

export async function fetchAdminInventory(): Promise<
  | { authorized: false }
  | {
      authorized: true;
      user: StaffUser;
      items: InventoryItem[];
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
    return {
      authorized: false,
    };
  }

  const meData = await me.json();

  if (
    !me.ok ||
    meData.user.role !== "ADMIN"
  ) {
    return {
      authorized: false,
    };
  }

  const response = await apiFetch(
    API_URL + "/admin/inventory",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      "No se pudo cargar el inventario.",
    );
  }

  return {
    authorized: true,
    user: meData.user,
    items:
      (await response.json()) as InventoryItem[],
  };
}

export async function createAdminInventoryItem(
  form: CreateInventoryForm,
) {
  const parsed =
    parseInventoryValues(form);

  const response = await apiFetch(
    API_URL + "/admin/inventory",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...parsed,
        active: true,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(data) ||
        "No se pudo crear el artículo.",
    );
  }

  return data as InventoryItem;
}

export async function updateAdminInventoryItem(
  id: string,
  draft: InventoryDraft,
) {
  const parsed =
    parseInventoryValues(draft);

  const response = await apiFetch(
    API_URL +
      "/admin/inventory/" +
      encodeURIComponent(id),
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(parsed),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(data) ||
        "No se pudo guardar el inventario.",
    );
  }

  return data as InventoryItem;
}

export async function setAdminInventoryItemActive(
  id: string,
  active: boolean,
) {
  const response = await apiFetch(
    API_URL +
      "/admin/inventory/" +
      encodeURIComponent(id),
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ active }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(data) ||
        "No se pudo actualizar el artículo.",
    );
  }

  return data as InventoryItem;
}

export async function deleteAdminInventoryItem(
  id: string,
) {
  const response = await apiFetch(
    API_URL +
      "/admin/inventory/" +
      encodeURIComponent(id),
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(data) ||
        "No se pudo eliminar el artículo.",
    );
  }

  return data;
}
