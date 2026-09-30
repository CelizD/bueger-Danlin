import {
  Injectable,
  Logger,
} from "@nestjs/common";
import { SmtpMailTransport } from "../notifications/smtp-mail.transport.js";

function privacyEmail() {
  return (
    process.env.PRIVACY_EMAIL
      ?.trim()
      .toLowerCase() ?? ""
  );
}

@Injectable()
export class ArcoNotificationService {
  private readonly logger =
    new Logger(
      ArcoNotificationService.name,
    );

  constructor(
    private readonly mail: SmtpMailTransport,
  ) {}

  async notifyReceived(input: {
    folio: string;
    requesterEmail: string;
    rights: string[];
  }) {
    if (!this.mail.isEnabled()) {
      return;
    }

    const rights =
      input.rights.join(", ");

    await this.mail
      .send({
        to: input.requesterEmail,
        subject:
          "Solicitud ARCO recibida " +
          input.folio,
        text:
          "Recibimos tu solicitud ARCO con folio " +
          input.folio +
          ". Derechos solicitados: " +
          rights +
          ". Antes de entregar, rectificar, cancelar u oponernos al tratamiento de datos, necesitaremos verificar tu identidad. La determinación se comunicará en un máximo de 20 días desde la recepción y, si procede, se hará efectiva dentro de los 15 días siguientes, sin perjuicio de la ampliación legal aplicable. Conserva este folio para tus registros.",
        html:
          "<p>Recibimos tu solicitud ARCO con folio <strong>" +
          input.folio +
          "</strong>.</p><p>Derechos solicitados: " +
          rights +
          ".</p><p>Antes de hacer efectivo el derecho, necesitaremos verificar tu identidad. Conserva este folio para tus registros.</p>",
      })
      .catch((error) => {
        this.logger.warn(
          "ARCO requester acknowledgement failed: " +
            (error instanceof Error
              ? error.message
              : String(error)),
        );
      });

    const destination =
      privacyEmail();

    if (!destination) {
      return;
    }

    await this.mail
      .send({
        to: destination,
        subject:
          "Nueva solicitud ARCO " +
          input.folio,
        text:
          "Se recibió una nueva solicitud ARCO. Folio: " +
          input.folio +
          ". Derechos: " +
          rights +
          ". Revisa el detalle desde el panel administrativo.",
        html:
          "<p>Se recibió una nueva solicitud ARCO.</p><p>Folio: <strong>" +
          input.folio +
          "</strong></p><p>Derechos: " +
          rights +
          ".</p><p>Revisa el detalle desde el panel administrativo.</p>",
      })
      .catch((error) => {
        this.logger.warn(
          "ARCO privacy mailbox notification failed: " +
            (error instanceof Error
              ? error.message
              : String(error)),
        );
      });
  }
}
