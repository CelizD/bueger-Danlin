import { describe, expect, it } from "vitest";
import {
  canAccessAdminSection,
  type AdminSection,
} from "./permissions";

const sections: AdminSection[] = [
  "dashboard",
  "pedidos",
  "cocina",
  "entrega",
  "sabados",
  "inventario",
  "personal",
];

describe("staff navigation permissions", () => {
  it("permite al administrador todas las secciones operativas", () => {
    for (const section of sections) {
      expect(canAccessAdminSection("ADMIN", section)).toBe(true);
    }
  });

  it("limita cocina a su operación", () => {
    expect(canAccessAdminSection("KITCHEN", "cocina")).toBe(true);

    for (const section of sections.filter((item) => item !== "cocina")) {
      expect(canAccessAdminSection("KITCHEN", section)).toBe(false);
    }
  });

  it("limita entrega a su operación", () => {
    expect(canAccessAdminSection("DELIVERY", "entrega")).toBe(true);

    for (const section of sections.filter((item) => item !== "entrega")) {
      expect(canAccessAdminSection("DELIVERY", section)).toBe(false);
    }
  });
});
