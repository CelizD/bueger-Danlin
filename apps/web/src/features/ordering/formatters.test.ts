import { describe, expect, it } from "vitest";
import { newBurger } from "./formatters";

describe("ordering helpers", () => {
  it("crea un combo local con removidos iniciales y sin extras", () => {
    const burger = newBurger(["lettuce"]);

    expect(burger.localId).toEqual(expect.any(String));
    expect(burger.localId.length).toBeGreaterThan(10);
    expect(burger.removedIds).toEqual(["lettuce"]);
    expect(burger.extraIds).toEqual([]);
  });
});
