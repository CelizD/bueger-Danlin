import { SiteFooter } from "@/components/site-footer";
import { ArcoRequestForm } from "@/features/privacy/arco/arco-request-form";
import { getPublicPrivacyConfig } from "@/features/privacy/privacy-config";
import { getPublicSellerConfig } from "@/features/seller/seller-config";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic =
  "force-dynamic";

export const metadata: Metadata = {
  title: "Derechos ARCO",
  description:
    "Mecanismo público para ejercer derechos de acceso, rectificación, cancelación y oposición sobre datos personales.",
};

export default function ArcoPage() {
  const privacy =
    getPublicPrivacyConfig();
  const seller =
    getPublicSellerConfig();

  return (
    <>
      <main className="privacy-page">
        <header className="privacy-hero">
          <Link
            className="privacy-back"
            href="/privacidad"
          >
            ← Aviso de Privacidad
          </Link>
          <p className="eyebrow">
            Protección de datos
          </p>
          <h1>
            Derechos ARCO
          </h1>
          <p>
            Solicita acceso,
            rectificación,
            cancelación u oposición
            respecto de tus datos
            personales.
          </p>
        </header>

        <article className="privacy-document">
          <section>
            <h2>
              Cómo funciona
            </h2>
            <p>
              Este formulario es el
              mecanismo público de{" "}
              <strong>
                {privacy.responsible}
              </strong>{" "}
              para recibir solicitudes
              ARCO. Al enviarlo
              recibirás un folio.
            </p>
            <p>
              La ley exige acreditar la
              identidad de la persona
              titular o, en su caso, de
              su representante. Para
              reducir la exposición de
              documentos sensibles, no
              cargamos identificaciones
              directamente en este
              formulario; la
              verificación se coordina
              después por el medio de
              contacto proporcionado.
            </p>
            <p>
              También puedes contactar
              al responsable mediante{" "}
              <a
                href={
                  "mailto:" +
                  privacy.email
                }
              >
                {privacy.email}
              </a>
              .
            </p>
          </section>
        </article>

        <ArcoRequestForm />
      </main>

      <SiteFooter
        seller={seller}
      />
    </>
  );
}
