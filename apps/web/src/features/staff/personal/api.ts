import {
  API_URL,
  apiFetch,
} from "@/lib/api/browser";
import type {
  CreateStaffForm,
  SessionUser,
  StaffRole,
  StaffUser,
} from "./types";

function message(data: { message?: string | string[] }) {
  return Array.isArray(data.message)
    ? data.message.join(" ")
    : data.message;
}

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

  const meData = await me.json();

  if (!me.ok || meData.user.role !== "ADMIN") {
    return { authorized: false };
  }

  const response = await apiFetch(
    API_URL + "/admin/staff",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      message(data) || "No se pudo crear la cuenta.",
    );
  }

  return data as StaffUser;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      message(data) ||
        "No se pudo actualizar la cuenta.",
    );
  }

  return data as StaffUser;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      message(data) ||
        "No se pudo restablecer el MFA.",
    );
  }

  return data;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      message(data) ||
        "No se pudo cambiar la contraseña.",
    );
  }

  return data;
}
