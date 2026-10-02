export type ContentSecurityPolicyOptions = {
  nonce: string;
  apiUrl?: string;
  isDevelopment: boolean;
};

export function apiOrigin(apiUrl?: string) {
  const value = apiUrl?.trim() || "http://localhost:4000/api/v1";

  try {
    return new URL(value).origin;
  } catch {
    return "http://localhost:4000";
  }
}

export function buildContentSecurityPolicy({
  nonce,
  apiUrl,
  isDevelopment,
}: ContentSecurityPolicyOptions) {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ];

  const connectSources = [
    "'self'",
    apiOrigin(apiUrl),
    ...(isDevelopment ? ["ws:"] : []),
  ];

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}
