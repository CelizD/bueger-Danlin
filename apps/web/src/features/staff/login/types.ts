export type StaffRole = "ADMIN" | "KITCHEN" | "DELIVERY";

export type LoginStage =
  | "password"
  | "setup"
  | "verify"
  | "recovery";

export type MfaSetup = {
  secret: string;
  otpauthUri: string;
  issuer: string;
  accountName: string;
};
