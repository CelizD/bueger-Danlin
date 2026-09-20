export const STAFF_SESSION_COOKIE = "burger_staff_session";
export const STAFF_SESSION_SECONDS = 8 * 60 * 60;

export const MFA_CHALLENGE_COOKIE = "burger_mfa_challenge";
export const MFA_CHALLENGE_SECONDS = 5 * 60;

export const STAFF_JWT_ISSUER = "burger-danlin-api";
export const STAFF_JWT_AUDIENCE = "burger-danlin-staff";
export const STAFF_JWT_ALGORITHM = "HS256" as const;
