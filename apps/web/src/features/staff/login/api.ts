import {
  API_URL,
  apiFetch,
  throwApiHttpError,
} from "@/lib/api/browser";
import type { MfaSetup, StaffRole } from "./types";

export async function checkStaffSession(): Promise<StaffRole | null> {
  const response = await apiFetch(
    API_URL + "/auth/me",
    {
      credentials: "include",
    },
  );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    return null;
  }

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo validar la sesión.",
    );
  }

  const data = await response.json();
  return data.user.role as StaffRole;
}

export async function submitStaffPassword(
  email: string,
  password: string,
) {
  const response = await apiFetch(
    API_URL + "/auth/login",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No fue posible iniciar sesión.",
    );
  }

  return response.json() as Promise<{
    mfaRequired?: boolean;
    setupRequired?: boolean;
    user?: { role: StaffRole };
  }>;
}

export async function fetchMfaSetup() {
  const response = await apiFetch(
    API_URL + "/auth/mfa/setup",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No fue posible preparar el segundo factor.",
    );
  }

  return response.json() as Promise<MfaSetup>;
}

export async function verifyStaffMfa(code: string) {
  const response = await apiFetch(
    API_URL + "/auth/mfa/verify",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: code.trim(),
      }),
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No fue posible verificar el código.",
    );
  }

  return response.json() as Promise<{
    user: { role: StaffRole };
    recoveryCodes?: string[];
  }>;
}


export async function logoutStaff() {
  const response = await apiFetch(
    API_URL + "/auth/logout",
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (response.status === 401) {
    return;
  }

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo cerrar la sesión.",
    );
  }
}
