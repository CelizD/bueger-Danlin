import { describe, expect, it } from "vitest";
import {
  containsForbiddenDisplayLanguage,
  isSafePersonDisplayName,
} from "./text-moderation.js";

describe("containsForbiddenDisplayLanguage", () => {
  it.each([
    "puto",
    "P U T O",
    "p.u.t.o",
    "p-u-t-o",
    "puuuuto",
    "p.u.t.4",
    "p3nd3j0",
    "m!erda",
    "c a b r o n",
    "f.u.c.k",
    "shiiit",
    "pυto",
  ])("detecta lenguaje no permitido aunque esté ofuscado: %j", (value) => {
    expect(
      containsForbiddenDisplayLanguage(value),
    ).toBe(true);
  });

  it.each([
    "Daniel Celiz",
    "Aarón López",
    "Computadora",
    "Cabrera",
    "Maricela",
    "Conrado",
  ])("no bloquea nombres o palabras legítimas: %j", (value) => {
    expect(
      containsForbiddenDisplayLanguage(value),
    ).toBe(false);
  });
});


describe("isSafePersonDisplayName", () => {
  it.each([
    "Daniel Celiz",
    "José María",
    "Ana-María",
    "O'Connor",
    "D’Angelo",
    "J. Ramón",
  ])("acepta nombres humanos válidos: %j", (value) => {
    expect(isSafePersonDisplayName(value)).toBe(true);
  });

  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)",
    "\" onmouseover=\"alert(1)",
    "{{constructor.constructor('alert(1)')()}}",
    "${alert(1)}",
    "<svg onload=alert(1)>",
    "'; DROP TABLE Customer; --",
    "Daniel\u200BCeliz",
  ])("rechaza markup o payloads de inyección: %j", (value) => {
    expect(isSafePersonDisplayName(value)).toBe(false);
  });
});
