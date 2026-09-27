import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PickupPointQrModal } from "./pickup-point-qr-modal";

describe("PickupPointQrModal", () => {
  it("renderiza un QR permanente con el enlace del punto", () => {
    const html = renderToStaticMarkup(
      <PickupPointQrModal
        pointName="Universidad"
        pointCode="UNIVERSIDAD"
        url="https://burger.example/?pickup=UNIVERSIDAD"
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("QR permanente del punto");
    expect(html).toContain("Universidad");
    expect(html).toContain("UNIVERSIDAD");
    expect(html).toContain("Copiar enlace");
    expect(html).toContain("Descargar SVG");
    expect(html).toContain("Imprimir");
    expect(html).toContain(
      "https://burger.example/?pickup=UNIVERSIDAD",
    );
    expect(html).toContain("<svg");
  });
});
