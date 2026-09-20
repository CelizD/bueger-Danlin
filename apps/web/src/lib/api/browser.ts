export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type ApiErrorPayload = {
  message?: string | string[];
};

export function apiErrorMessage(
  payload: ApiErrorPayload | null | undefined,
  fallback: string,
) {
  if (Array.isArray(payload?.message)) {
    return payload.message.join(" ");
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return fallback;
}
