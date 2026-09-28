"use client";

import { useState } from "react";
import type {
  CreateStaffForm,
  PasswordResetForm,
  StaffRole,
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

export function useStaffForms() {
  const [createOpen, setCreateOpen] =
    useState(false);
  const [createForm, setCreateForm] =
    useState<CreateStaffForm>(
      EMPTY_CREATE,
    );
  const [resetUser, setResetUser] =
    useState<StaffUser | null>(null);
  const [resetForm, setResetForm] =
    useState<PasswordResetForm>(
      EMPTY_RESET,
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
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
  }

  function resetCreate() {
    setCreateForm(EMPTY_CREATE);
    setCreateOpen(false);
  }

  function openPasswordReset(
    staff: StaffUser,
  ) {
    setResetForm(EMPTY_RESET);
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

  return {
    createOpen,
    createForm,
    resetUser,
    resetForm,
    setCreateField,
    openCreate,
    closeCreate,
    resetCreate,
    openPasswordReset,
    closePasswordReset,
    setResetField,
  };
}
