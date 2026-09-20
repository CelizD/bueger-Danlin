import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { WebVitalsDto } from "./web-vitals.dto.js";

function metric(name: WebVitalsDto["name"]) {
  return Object.assign(new WebVitalsDto(), {
    name,
    value: 42,
    delta: 10,
    rating: "good" as const,
    metricId: "v1-test-metric",
    route: "/admin/dashboard",
    navigationType: "navigate",
  });
}

describe("WebVitalsDto", () => {
  it.each([
    "CLS",
    "FCP",
    "FID",
    "INP",
    "LCP",
    "TTFB",
  ] as const)("acepta la métrica %s de Next.js", async (name) => {
    const errors = await validate(metric(name));

    expect(errors).toHaveLength(0);
  });

  it("rechaza una métrica desconocida", async () => {
    const dto = metric("LCP");
    (dto as { name: string }).name = "UNKNOWN";

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "name")).toBe(true);
  });
});
