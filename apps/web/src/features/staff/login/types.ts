export type { StaffRole } from "../types";

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
