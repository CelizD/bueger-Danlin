import { API_URL, apiFetch } from "@/lib/api/browser";
import type { MfaSetup, StaffRole } from "./types";

function responseMessage(
  data: { message?: string | string[] },
  fallback: string,
) {
  const message = Array.isArray(data.message)
    ? data.message.join(" ")
    : data.message;

  return message || fallback;
}

export async function checkStaffSession(): Promise<StaffRole | null> {
  const response = await apiFetch(
    API_URL + "/auth/me",
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    return null;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(
        data,
        "No fue posible iniciar sesión.",
      ),
    );
  }

  return data as {
    mfaRequired?: boolean;
    setupRequired?: boolean;
    user?: { role: StaffRole };
  };
}

export async function fetchMfaSetup() {
  const response = await apiFetch(
    API_URL + "/auth/mfa/setup",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(
        data,
        "No fue posible preparar el segundo factor.",
      ),
    );
  }

  return data as MfaSetup;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      responseMessage(
        data,
        "No fue posible verificar el código.",
      ),
    );
  }

  return data as {
    user: { role: StaffRole };
    recoveryCodes?: string[];
  };
}
