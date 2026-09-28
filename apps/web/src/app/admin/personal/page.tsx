"use client";

import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { StaffCreateForm } from "@/features/staff/components/staff-create-form";
import { StaffMetrics } from "@/features/staff/components/staff-metrics";
import { StaffPasswordModal } from "@/features/staff/components/staff-password-modal";
import { StaffRolePermissions } from "@/features/staff/components/staff-role-permissions";
import { StaffToolbar } from "@/features/staff/components/staff-toolbar";
import { StaffUserList } from "@/features/staff/components/staff-user-list";
import { useAdminStaff } from "@/features/staff/personal/use-admin-staff";
import {
  RefreshCw,
  UserPlus,
} from "lucide-react";

export default function StaffPage() {
  const {
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
  } = useAdminStaff();

  if (loading) {
    return (
      <main className="admin-loading">
        Cargando personal…
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminSidebar
        user={sessionUser}
        active="personal"
        subtitle="Operaciones"
      />

      <section className="admin-content staff-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">
              Accesos y permisos
            </p>
            <h1>Personal</h1>
            <p>
              Crea cuentas individuales y
              controla qué parte de la
              operación puede usar cada
              persona.
            </p>
          </div>

          <div className="staff-header-actions">
            <button
              className="admin-refresh"
              type="button"
              onClick={() =>
                void load(true)
              }
              disabled={refreshing}
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "admin-spin"
                    : undefined
                }
              />
              Actualizar
            </button>

            <button
              className="staff-create-button"
              type="button"
              onClick={openCreate}
            >
              <UserPlus size={17} />
              Nueva cuenta
            </button>
          </div>
        </header>

        {error && (
          <div className="admin-error-banner">
            {error}
          </div>
        )}

        {success && (
          <div className="saturday-success">
            {success}
          </div>
        )}

        <StaffMetrics
          total={counts.total}
          active={counts.active}
          admins={counts.admins}
        />

        {createOpen && (
          <StaffCreateForm
            form={createForm}
            creating={creating}
            onChange={setCreateField}
            onClose={closeCreate}
            onSubmit={createUser}
          />
        )}

        <StaffToolbar
          query={query}
          roleFilter={roleFilter}
          onQueryChange={setQuery}
          onRoleChange={setRoleFilter}
        />

        <StaffUserList
          users={filteredUsers}
          sessionUser={sessionUser}
          busyId={busyId}
          onUpdate={(staff, patch) => {
            void updateUser(
              staff,
              patch,
            );
          }}
          onResetMfa={(staff) => {
            void resetMfa(staff);
          }}
          onPassword={
            openPasswordReset
          }
        />

        <StaffRolePermissions />
      </section>

      {resetUser && (
        <StaffPasswordModal
          user={resetUser}
          form={resetForm}
          resetting={resetting}
          onChange={setResetField}
          onClose={
            closePasswordReset
          }
          onSubmit={
            submitPasswordReset
          }
        />
      )}
    </main>
  );
}
