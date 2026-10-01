import type {
  ManagedStaffUser,
  StaffRole as SharedStaffRole,
  StaffSessionUser,
} from "../types";

export type { StaffRole } from "../types";

export type SessionUser = StaffSessionUser;
export type StaffUser = ManagedStaffUser;

export type StaffRoleFilter = "ALL" | SharedStaffRole;

export type CreateStaffForm = {
  name: string;
  email: string;
  role: SharedStaffRole;
  password: string;
};

export type PasswordResetForm = {
  password: string;
  confirm: string;
};
