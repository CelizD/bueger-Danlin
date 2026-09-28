export type StaffRole = "ADMIN" | "KITCHEN" | "DELIVERY";

export type SessionUser = {
  sub: string;
  name: string;
  email: string;
  role: StaffRole;
};

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  mfaEnabled: boolean;
  mfaEnrolledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffRoleFilter = "ALL" | StaffRole;

export type CreateStaffForm = {
  name: string;
  email: string;
  role: StaffRole;
  password: string;
};

export type PasswordResetForm = {
  password: string;
  confirm: string;
};
