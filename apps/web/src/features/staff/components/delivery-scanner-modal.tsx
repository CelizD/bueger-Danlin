import { X } from "lucide-react";
import type {
  RefObject,
} from "react";

export function DeliveryScannerModal({
  videoRef,
  onClose,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  onClose: () => void;
}) {
  return (
    <div
      className="qr-scanner-overlay"
      role="dialog"
      aria-modal="true"
    >
      <div className="qr-scanner-modal">
        <div className="qr-scanner-head">
          <div>
            <p className="admin-kicker">
              Entrega segura
            </p>
            <h2>Escanea el QR</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cámara"
          >
            <X size={20} />
          </button>
        </div>

        <div className="qr-camera-frame">
          <video
            ref={videoRef}
            muted
            playsInline
          />
          <div className="qr-camera-guide">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <p className="qr-scanner-help">
          Coloca el QR del cliente
          dentro del recuadro. Se
          validará automáticamente
          cuando la cámara pueda leerlo.
        </p>
      </div>
    </div>
  );
}
