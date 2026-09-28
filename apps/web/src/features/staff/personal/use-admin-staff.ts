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
  SessionUser,
  StaffRole,
  StaffRoleFilter,
  StaffUser,
} from "./types";
import { useStaffForms } from "./use-staff-forms";

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
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  const [creating, setCreating] =
    useState(false);
  const [resetting, setResetting] =
    useState(false);

  const forms = useStaffForms();

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

  function openCreate() {
    setError("");
    setSuccess("");
    forms.openCreate();
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
          forms.createForm,
        );

      forms.resetCreate();
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
    setError("");
    setSuccess("");
    forms.openPasswordReset(staff);
  }

  async function submitPasswordReset(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!forms.resetUser) {
      return;
    }

    if (
      forms.resetForm.password !==
      forms.resetForm.confirm
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
        forms.resetUser.id,
        forms.resetForm.password,
      );

      const changedSelf =
        forms.resetUser.id ===
        sessionUser?.sub;
      const changedName =
        forms.resetUser.name;

      forms.closePasswordReset();

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
    ...forms,
    sessionUser,
    filteredUsers,
    counts,
    query,
    roleFilter,
    loading,
    refreshing,
    busyId,
    error,
    success,
    creating,
    resetting,
    setQuery,
    setRoleFilter,
    load,
    openCreate,
    createUser,
    updateUser,
    resetMfa,
    openPasswordReset,
    submitPasswordReset,
  };
}
