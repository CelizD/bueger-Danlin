"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createAdminStaff,
  fetchAdminStaff,
  resetAdminStaffMfa,
  resetAdminStaffPassword,
  updateAdminStaff,
} from "./api";
import type {
  CreateStaffForm,
  PasswordResetForm,
  SessionUser,
  StaffRole,
  StaffRoleFilter,
  StaffUser,
} from "./types";

const EMPTY_CREATE: CreateStaffForm = {
  name: "",
  email: "",
  role: "KITCHEN",
  password: "",
};

const EMPTY_RESET: PasswordResetForm = {
  password: "",
  confirm: "",
};

export function useAdminStaff() {
  const [sessionUser, setSessionUser] =
    useState<SessionUser | null>(null);
  const [users, setUsers] =
    useState<StaffUser[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<StaffRoleFilter>("ALL");
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [busyId, setBusyId] =
    useState<string | null>(null);
  const [createOpen, setCreateOpen] =
    useState(false);
  const [resetUser, setResetUser] =
    useState<StaffUser | null>(null);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  const [createForm, setCreateForm] =
    useState<CreateStaffForm>(EMPTY_CREATE);
  const [resetForm, setResetForm] =
    useState<PasswordResetForm>(EMPTY_RESET);
  const [creating, setCreating] =
    useState(false);
  const [resetting, setResetting] =
    useState(false);

  async function load(
    showRefresh = false,
  ) {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const result =
        await fetchAdminStaff();

      if (!result.authorized) {
        window.location.replace(
          "/admin/login",
        );
        return;
      }

      setSessionUser(result.user);
      setUsers(result.staff);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el personal.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalized =
      query.trim().toLowerCase();

    return users.filter((staff) => {
      const matchesRole =
        roleFilter === "ALL" ||
        staff.role === roleFilter;

      const matchesQuery =
        !normalized ||
        staff.name
          .toLowerCase()
          .includes(normalized) ||
        staff.email
          .toLowerCase()
          .includes(normalized);

      return (
        matchesRole &&
        matchesQuery
      );
    });
  }, [users, query, roleFilter]);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter(
        (staff) => staff.active,
      ).length,
      admins: users.filter(
        (staff) =>
          staff.role === "ADMIN" &&
          staff.active,
      ).length,
    }),
    [users],
  );

  function setCreateField(
    field: keyof CreateStaffForm,
    value: string,
  ) {
    setCreateForm((current) => ({
      ...current,
      [field]:
        field === "role"
          ? (value as StaffRole)
          : value,
    }));
  }

  function openCreate() {
    setError("");
    setSuccess("");
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
  }

  async function createUser(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const data =
        await createAdminStaff(
          createForm,
        );

      setCreateForm(EMPTY_CREATE);
      setCreateOpen(false);
      setSuccess(
        `Cuenta creada para ${data.name}.`,
      );
      await load();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear la cuenta.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(
    staff: StaffUser,
    patch: {
      role?: StaffRole;
      active?: boolean;
    },
  ) {
    setBusyId(staff.id);
    setError("");
    setSuccess("");

    try {
      const data =
        await updateAdminStaff(
          staff.id,
          patch,
        );

      setSuccess(
        patch.active !== undefined
          ? patch.active
            ? `${data.name} fue activado.`
            : `${data.name} fue desactivado.`
          : `Rol de ${data.name} actualizado.`,
      );

      await load();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar la cuenta.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function resetMfa(
    staff: StaffUser,
  ) {
    if (
      staff.role !== "ADMIN" ||
      staff.id === sessionUser?.sub
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `¿Restablecer el MFA de ${staff.name}? Su sesión administrativa dejará de funcionar y tendrá que configurar un nuevo autenticador al iniciar sesión.`,
      );

    if (!confirmed) {
      return;
    }

    setBusyId(staff.id);
    setError("");
    setSuccess("");

    try {
      await resetAdminStaffMfa(
        staff.id,
      );

      setSuccess(
        `MFA de ${staff.name} restablecido. Deberá configurarlo de nuevo en su próximo inicio de sesión.`,
      );
      await load();
    } catch (mfaError) {
      setError(
        mfaError instanceof Error
          ? mfaError.message
          : "No se pudo restablecer el MFA.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function openPasswordReset(
    staff: StaffUser,
  ) {
    setResetForm(EMPTY_RESET);
    setError("");
    setSuccess("");
    setResetUser(staff);
  }

  function closePasswordReset() {
    setResetUser(null);
    setResetForm(EMPTY_RESET);
  }

  function setResetField(
    field: keyof PasswordResetForm,
    value: string,
  ) {
    setResetForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitPasswordReset(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!resetUser) {
      return;
    }

    if (
      resetForm.password !==
      resetForm.confirm
    ) {
      setError(
        "Las contraseñas no coinciden.",
      );
      return;
    }

    setResetting(true);
    setError("");
    setSuccess("");

    try {
      await resetAdminStaffPassword(
        resetUser.id,
        resetForm.password,
      );

      const changedSelf =
        resetUser.id ===
        sessionUser?.sub;
      const changedName =
        resetUser.name;

      closePasswordReset();

      if (changedSelf) {
        window.location.replace(
          "/admin/login",
        );
        return;
      }

      setSuccess(
        `Contraseña de ${changedName} actualizada. Sus sesiones anteriores quedaron invalidadas.`,
      );

      await load();
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "No se pudo cambiar la contraseña.",
      );
    } finally {
      setResetting(false);
    }
  }

  return {
    sessionUser,
    filteredUsers,
    counts,
    query,
    roleFilter,
    loading,
    refreshing,
    busyId,
    createOpen,
    resetUser,
    error,
    success,
    createForm,
    resetForm,
    creating,
    resetting,
    setQuery,
    setRoleFilter,
    load,
    setCreateField,
    openCreate,
    closeCreate,
    createUser,
    updateUser,
    resetMfa,
    openPasswordReset,
    closePasswordReset,
    setResetField,
    submitPasswordReset,
  };
}
