"use client";

import {
  Copy,
  Download,
  ExternalLink,
  Printer,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";

type PickupPointQrModalProps = {
  pointName: string;
  pointCode: string;
  url: string;
  onClose: () => void;
};

function safeFilePart(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "punto"
  );
}

export function PickupPointQrModal({
  pointName,
  pointCode,
  url,
  onClose,
}: PickupPointQrModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("textarea");
      input.value = url;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function svgElement() {
    return qrRef.current?.querySelector("svg") ?? null;
  }

  function downloadSvg() {
    const svg = svgElement();
    if (!svg) return;

    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob(
      ['<?xml version="1.0" encoding="UTF-8"?>\n', serialized],
      { type: "image/svg+xml;charset=utf-8" },
    );
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = href;
    anchor.download =
      "burger-danlin-" +
      safeFilePart(pointCode) +
      "-qr.svg";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  function printQr() {
    const svg = svgElement();
    if (!svg) return;

    const printWindow = window.open(
      "",
      "_blank",
      "width=640,height=780",
    );

    if (!printWindow) return;

    printWindow.opener = null;

    const doc = printWindow.document;
    doc.title = "QR " + pointName;

    const style = doc.createElement("style");
    style.textContent = [
      "body{font-family:Arial,sans-serif;margin:0;padding:40px;text-align:center;color:#171717}",
      ".sheet{max-width:520px;margin:0 auto}",
      "h1{font-size:30px;margin:0 0 8px}",
      "p{font-size:16px;margin:0 0 24px;color:#555}",
      ".qr{display:inline-block;padding:24px;border:2px solid #111;border-radius:18px}",
      ".qr svg{width:320px;height:320px}",
      "code{display:block;margin-top:22px;font-size:12px;overflow-wrap:anywhere;color:#555}",
      "@media print{body{padding:18mm}.qr svg{width:90mm;height:90mm}}",
    ].join("");

    const sheet = doc.createElement("main");
    sheet.className = "sheet";

    const heading = doc.createElement("h1");
    heading.textContent = "Burger Danlin · " + pointName;

    const copy = doc.createElement("p");
    copy.textContent =
      "Escanea para hacer tu pedido directamente en este punto de entrega.";

    const qr = doc.createElement("div");
    qr.className = "qr";
    qr.appendChild(doc.importNode(svg, true));

    const link = doc.createElement("code");
    link.textContent = url;

    sheet.append(heading, copy, qr, link);
    doc.head.appendChild(style);
    doc.body.appendChild(sheet);

    printWindow.focus();
    printWindow.print();
  }

  function openCustomerPage() {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="pickup-qr-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="pickup-qr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-qr-title"
      >
        <div className="pickup-qr-head">
          <div>
            <span>QR permanente del punto</span>
            <h2 id="pickup-qr-title">{pointName}</h2>
          </div>
          <button
            type="button"
            className="pickup-qr-close"
            onClick={onClose}
            aria-label="Cerrar QR"
          >
            <X size={19} />
          </button>
        </div>

        <div className="pickup-qr-code" ref={qrRef}>
          <QRCodeSVG
            value={url}
            size={260}
            level="M"
            marginSize={4}
            title={"Pedido Burger Danlin · " + pointName}
          />
        </div>

        <p className="pickup-qr-explainer">
          Este QR no cambia cada sábado. Mientras el código del
          punto siga siendo <strong>{pointCode}</strong>, el mismo
          cartel puede reutilizarse.
        </p>

        <code className="pickup-qr-url">{url}</code>

        <div className="pickup-qr-actions">
          <button type="button" onClick={() => void copyUrl()}>
            <Copy size={16} />
            {copied ? "Copiado" : "Copiar enlace"}
          </button>
          <button type="button" onClick={openCustomerPage}>
            <ExternalLink size={16} />
            Abrir
          </button>
          <button type="button" onClick={downloadSvg}>
            <Download size={16} />
            Descargar SVG
          </button>
          <button type="button" onClick={printQr}>
            <Printer size={16} />
            Imprimir
          </button>
        </div>

        <p className="pickup-qr-note">
          El enlace usa el dominio actual del panel. Genera e imprime
          los carteles definitivos desde producción para que apunten al
          dominio real.
        </p>
      </section>
    </div>
  );
}
