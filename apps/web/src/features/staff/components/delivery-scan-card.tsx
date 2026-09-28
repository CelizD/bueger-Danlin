import {
  Camera,
  ScanLine,
} from "lucide-react";

export function DeliveryScanCard({
  onOpen,
}: {
  onOpen: () => void;
}) {
  return (
    <section className="delivery-scan-card">
      <div>
        <div className="delivery-scan-icon">
          <ScanLine size={25} />
        </div>
        <div>
          <strong>
            Escanear QR de entrega
          </strong>
          <span>
            La cámara valida el QR
            directamente contra el pedido
            guardado.
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
      >
        <Camera size={18} />
        Abrir cámara
      </button>
    </section>
  );
}
