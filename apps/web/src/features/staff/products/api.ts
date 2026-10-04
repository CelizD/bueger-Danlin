import {
  apiFetch,
  throwApiHttpError,
} from "@/lib/api/browser";
import type { AdminProductImage } from "./types";

export async function fetchAdminProducts() {
  const response = await apiFetch(
    "/admin/products",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudieron cargar los productos.",
    );
  }

  return response.json() as Promise<
    AdminProductImage[]
  >;
}

export async function uploadAdminProductImage(
  productId: string,
  file: File,
) {
  const body = new FormData();
  body.append("image", file);

  const response = await apiFetch(
    `/admin/products/${encodeURIComponent(
      productId,
    )}/image`,
    {
      method: "POST",
      credentials: "include",
      body,
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo subir la imagen.",
    );
  }

  return response.json();
}

export async function removeAdminProductImage(
  productId: string,
) {
  const response = await apiFetch(
    `/admin/products/${encodeURIComponent(
      productId,
    )}/image`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo quitar la imagen.",
    );
  }

  return response.json();
}
