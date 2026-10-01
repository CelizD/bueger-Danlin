import {
  API_URL,
  apiFetch,
  throwApiHttpError,
} from "@/lib/api/browser";
import type {
  CreateInventoryForm,
  InventoryDraft,
  InventoryItem,
  StaffUser,
} from "./types";
import { parseInventoryValues } from "./validation";

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

  if (!me.ok) {
    await throwApiHttpError(
      me,
      "No se pudo validar la sesión.",
    );
  }

  const meData = await me.json();

  if (meData.user.role !== "ADMIN") {
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

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    return {
      authorized: false,
    };
  }

  if (!response.ok) {
    await throwApiHttpError(
      response,
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

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo crear el artículo.",
    );
  }

  return response.json() as Promise<InventoryItem>;
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

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo guardar el inventario.",
    );
  }

  return response.json() as Promise<InventoryItem>;
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

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo actualizar el artículo.",
    );
  }

  return response.json() as Promise<InventoryItem>;
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

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo eliminar el artículo.",
    );
  }

  return response.json();
}
