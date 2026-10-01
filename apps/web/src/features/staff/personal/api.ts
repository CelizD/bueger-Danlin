import {
  API_URL,
  apiFetch,
  throwApiHttpError,
} from "@/lib/api/browser";
import type {
  CreateStaffForm,
  SessionUser,
  StaffRole,
  StaffUser,
} from "./types";

export async function fetchAdminStaff(): Promise<
  | { authorized: false }
  | {
      authorized: true;
      user: SessionUser;
      staff: StaffUser[];
    }
> {
  const me = await apiFetch(API_URL + "/auth/me", {
    credentials: "include",
    cache: "no-store",
  });

  if (me.status === 401) {
    return { authorized: false };
  }

  if (!me.ok) {
    await throwApiHttpError(
      me,
      "No se pudo validar la sesión.",
    );
  }

  const meData = await me.json();

  if (meData.user.role !== "ADMIN") {
    return { authorized: false };
  }

  const response = await apiFetch(
    API_URL + "/admin/staff",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    return { authorized: false };
  }

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudieron cargar las cuentas del personal.",
    );
  }

  return {
    authorized: true,
    user: meData.user,
    staff: (await response.json()) as StaffUser[],
  };
}

export async function createAdminStaff(
  form: CreateStaffForm,
) {
  const response = await apiFetch(
    API_URL + "/admin/staff",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password,
      }),
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo crear la cuenta.",
    );
  }

  return response.json() as Promise<StaffUser>;
}

export async function updateAdminStaff(
  id: string,
  patch: {
    role?: StaffRole;
    active?: boolean;
  },
) {
  const response = await apiFetch(
    API_URL +
      "/admin/staff/" +
      encodeURIComponent(id),
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo actualizar la cuenta.",
    );
  }

  return response.json() as Promise<StaffUser>;
}

export async function resetAdminStaffMfa(id: string) {
  const response = await apiFetch(
    API_URL +
      "/admin/staff/" +
      encodeURIComponent(id) +
      "/mfa/reset",
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo restablecer el MFA.",
    );
  }

  return response.json();
}

export async function resetAdminStaffPassword(
  id: string,
  password: string,
) {
  const response = await apiFetch(
    API_URL +
      "/admin/staff/" +
      encodeURIComponent(id) +
      "/password",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ password }),
    },
  );

  if (!response.ok) {
    await throwApiHttpError(
      response,
      "No se pudo cambiar la contraseña.",
    );
  }

  return response.json();
}
