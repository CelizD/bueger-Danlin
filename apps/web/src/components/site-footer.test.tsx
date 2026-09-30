import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("muestra vendedor, RFC, domicilio y canales de soporte", () => {
    const html =
      renderToStaticMarkup(
        <SiteFooter
          seller={{
            legalName:
              "Persona Vendedora",
            tradeName:
              "Burger Danlin",
            rfc:
              "ABCD010101ABC",
            address:
              "Domicilio comercial 123",
            supportPhone:
              "+52 664 123 4567",
            supportEmail:
              "soporte@example.com",
            configured: true,
          }}
        />,
      );

    expect(html).toContain(
      "Persona Vendedora",
    );
    expect(html).toContain(
      "ABCD010101ABC",
    );
    expect(html).toContain(
      "Domicilio comercial 123",
    );
    expect(html).toContain(
      "soporte@example.com",
    );
    expect(html).toContain(
      'href="tel:+526641234567"',
    );
    expect(html).toContain(
      'href="/terminos"',
    );
    expect(html).toContain(
      'href="/privacidad"',
    );
  });
});
