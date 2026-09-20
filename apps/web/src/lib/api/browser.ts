export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type ApiErrorPayload = {
  message?: string | string[];
  error?: {
    message?: string | string[];
    requestId?: string;
  };
};

export function createBrowserRequestId() {
  return crypto.randomUUID();
}

export function apiUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const path = pathOrUrl.startsWith("/")
    ? pathOrUrl
    : `/${pathOrUrl}`;

  return `${API_URL}${path}`;
}

export async function apiFetch(
  pathOrUrl: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);

  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", createBrowserRequestId());
  }

  return fetch(apiUrl(pathOrUrl), {
    ...init,
    headers,
  });
}

export function responseRequestId(response: Response) {
  return response.headers.get("x-request-id") ?? undefined;
}

export function apiErrorMessage(
  payload: ApiErrorPayload | null | undefined,
  fallback: string,
) {
  const message =
    payload?.message ??
    payload?.error?.message;

  if (Array.isArray(message)) {
    return message.join(" ");
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return fallback;
}

export function apiErrorRequestId(
  payload: ApiErrorPayload | null | undefined,
) {
  return payload?.error?.requestId;
}
