export type ArcoRight =
  | "ACCESS"
  | "RECTIFICATION"
  | "CANCELLATION"
  | "OPPOSITION";

export type ArcoRequestResult = {
  folio: string;
  status:
    | "IDENTITY_VERIFICATION_REQUIRED"
    | "IN_REVIEW"
    | "RESOLVED"
    | "DENIED";
  receivedAt: string;
  identityVerificationRequired: boolean;
  message: string;
};
