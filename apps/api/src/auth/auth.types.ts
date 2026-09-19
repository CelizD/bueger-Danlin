export type StaffRole = "ADMIN" | "KITCHEN" | "DELIVERY";

export type StaffSession = {
  sub: string;
  email: string;
  name: string;
  role: StaffRole;
  iat?: number;
  exp?: number;
};

export type StaffRequest = {
  cookies?: Record<string, string | undefined>;
  user?: StaffSession;
};
