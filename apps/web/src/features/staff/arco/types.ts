export type ArcoRight =
  | "ACCESS"
  | "RECTIFICATION"
  | "CANCELLATION"
  | "OPPOSITION";

export type ArcoRequestStatus =
  | "IDENTITY_VERIFICATION_REQUIRED"
  | "IN_REVIEW"
  | "RESOLVED"
  | "DENIED";

export type AdminArcoRequest = {
  id: string;
  folio: string;
  name: string;
  email: string;
  phone: string | null;
  rights: ArcoRight[];
  description: string;
  locatorInfo: string | null;
  rectificationDetails: string | null;
  cancellationReason: string | null;
  oppositionReason: string | null;
  status: ArcoRequestStatus;
  identityVerifiedAt: string | null;
  resolvedAt: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
};
