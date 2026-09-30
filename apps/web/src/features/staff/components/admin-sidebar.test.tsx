import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminSidebar } from "./admin-sidebar";

describe("AdminSidebar", () => {
  it("muestra toda la navegación a un administrador", () => {
    const html = renderToStaticMarkup(
      <AdminSidebar
        user={{
          name: "Admin",
          email: "admin@example.com",
          role: "ADMIN",
        }}
        active="inventario"
      />,
    );

    expect(html).toContain("Panel del día");
    expect(html).toContain("Pedidos");
    expect(html).toContain("Cocina");
    expect(html).toContain("Entrega");
    expect(html).toContain("Sábados");
    expect(html).toContain("Inventario");
    expect(html).toContain("Privacidad ARCO");
    expect(html).toContain("Personal");
    expect(html).toContain('aria-current="page"');
  });

  it("solo muestra Cocina al rol KITCHEN", () => {
    const html = renderToStaticMarkup(
      <AdminSidebar
        user={{
          name: "Cocina",
          email: "cocina@example.com",
          role: "KITCHEN",
        }}
        active="cocina"
        subtitle="Cocina"
      />,
    );

    expect(html).toContain("Cocina");
    expect(html).not.toContain(">Panel del día<");
    expect(html).not.toContain(">Pedidos<");
    expect(html).not.toContain(">Inventario<");
    expect(html).not.toContain(">Privacidad ARCO<");
    expect(html).not.toContain(">Personal<");
  });

  it("solo muestra Entrega al rol DELIVERY", () => {
    const html = renderToStaticMarkup(
      <AdminSidebar
        user={{
          name: "Entrega",
          email: "entrega@example.com",
          role: "DELIVERY",
        }}
        active="entrega"
        subtitle="Entrega"
      />,
    );

    expect(html).toContain("Entrega");
    expect(html).not.toContain(">Panel del día<");
    expect(html).not.toContain(">Pedidos<");
    expect(html).not.toContain(">Inventario<");
    expect(html).not.toContain(">Personal<");
  });
});
