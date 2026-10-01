import {
  API_URL,
  apiFetch,
  throwApiHttpError,
} from "@/lib/api/browser";
import type {
  AdminArcoRequest,
  ArcoRequestStatus,
} from "./types";
import type { StaffSessionUser } from "../types";

export async function fetchAdminArco() {
  const meResponse =
    await apiFetch(
      API_URL + "/auth/me",
      {
        credentials: "include",
        cache: "no-store",
      },
    );

  if (
    meResponse.status === 401
  ) {
    return {
      authorized:
        false as const,
    };
  }

  if (!meResponse.ok) {
    await throwApiHttpError(
      meResponse,
      "No se pudo validar la sesión.",
    );
  }

  const me =
    await meResponse.json();

  const response =
    await apiFetch(
      API_URL + "/admin/arco",
      {
        credentials:
          "include",
        cache: "no-store",
      },
    );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    return {
      authorized:
        false as const,
    };
  }

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudieron cargar las solicitudes ARCO.",
    );
  }

  return {
    authorized:
      true as const,
    user:
      me.user as StaffSessionUser,
    requests:
      (await response.json()) as AdminArcoRequest[],
  };
}

export async function updateAdminArco(
  folio: string,
  input: {
    status?: ArcoRequestStatus;
    identityVerified?: boolean;
    adminNote?: string;
  },
) {
  const response =
    await apiFetch(
      API_URL +
        "/admin/arco/" +
        encodeURIComponent(
          folio,
        ),
      {
        method: "PATCH",
        credentials:
          "include",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify(
          input,
        ),
      },
    );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo actualizar la solicitud ARCO.",
    );
  }

  return response.json() as Promise<AdminArcoRequest>;
}
