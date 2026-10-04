import { describe, expect, it } from "vitest";
import {
  apiOrigin,
  buildContentSecurityPolicy,
} from "./csp";

function directive(policy: string, name: string) {
  return (
    policy
      .split("; ")
      .find((entry) => entry.startsWith(`${name} `)) ?? ""
  );
}

describe("Content Security Policy", () => {
  it("uses a nonce for scripts and removes unsafe-inline in production", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      apiUrl: "https://api.example.com/api/v1",
      isDevelopment: false,
    });

    const script = directive(policy, "script-src");

    expect(script).toContain("'nonce-test-nonce'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(directive(policy, "img-src")).toContain(
      "https://api.example.com",
    );
  });

  it("keeps only the development eval exception required by Next.js", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "dev-nonce",
      apiUrl: "http://localhost:4000/api/v1",
      isDevelopment: true,
    });

    const script = directive(policy, "script-src");

    expect(script).toContain("'nonce-dev-nonce'");
    expect(script).toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(directive(policy, "connect-src")).toContain("ws:");
  });

  it("allows the configured API origin without including its path", () => {
    expect(apiOrigin("https://api.example.com/api/v1")).toBe(
      "https://api.example.com",
    );
  });

  it("falls back safely when the API URL is invalid", () => {
    expect(apiOrigin("not a url")).toBe("http://localhost:4000");
  });
});
