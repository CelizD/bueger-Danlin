import { describe, expect, it } from "vitest";
import { containsForbiddenDisplayLanguage } from "./text-moderation.js";

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
