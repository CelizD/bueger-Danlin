export type StaffRole =
  | "ADMIN"
  | "KITCHEN"
  | "DELIVERY";

export type StaffSessionUser = {
  id?: string;
  sub?: string;
  name: string;
  email: string;
  role: StaffRole;
};

export type ManagedStaffUser = {
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
