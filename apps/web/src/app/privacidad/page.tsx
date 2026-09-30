import { SiteFooter } from "@/components/site-footer";
import { getPublicPrivacyConfig } from "@/features/privacy/privacy-config";
import { getPublicSellerConfig } from "@/features/seller/seller-config";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aviso de Privacidad",
  description:
    "Aviso de Privacidad integral de Burger Danlin.",
};

export default function PrivacyPage() {
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
          href="/"
        >
          ← Volver a pedidos
        </Link>
        <p className="eyebrow">
          Burger Danlin
        </p>
        <h1>Aviso de Privacidad</h1>
        <p>
          Última actualización: 30 de septiembre de 2026.
        </p>
      </header>

      {!privacy.configured &&
        process.env.NODE_ENV !==
          "production" && (
          <div
            className="privacy-dev-warning"
            role="status"
          >
            Configura PRIVACY_RESPONSIBLE,
            PRIVACY_ADDRESS y PRIVACY_EMAIL
            antes del lanzamiento.
          </div>
        )}

      <article className="privacy-document">
        <section>
          <h2>1. Responsable</h2>
          <p>
            <strong>
              {privacy.responsible}
            </strong>
            , con domicilio en{" "}
            <strong>
              {privacy.address}
            </strong>
            , es responsable del tratamiento
            de los datos personales recabados
            mediante este sitio y el flujo de
            pedidos de Burger Danlin.
          </p>
          <p>
            Para temas de privacidad y
            protección de datos puedes
            escribir a{" "}
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

        <section>
          <h2>
            2. Datos personales que tratamos
          </h2>
          <p>
            Podemos tratar los siguientes
            datos cuando realizas o administras
            un pedido:
          </p>
          <ul>
            <li>nombre;</li>
            <li>teléfono;</li>
            <li>
              correo electrónico, cuando lo
              proporcionas de forma opcional;
            </li>
            <li>
              código, contenido, cantidades,
              importes, estado y fechas de tu
              pedido;
            </li>
            <li>
              estado del pago, monto, moneda e
              identificadores técnicos del
              proveedor de pago;
            </li>
            <li>
              datos técnicos de seguridad y
              operación, como dirección IP,
              agente de usuario, identificador
              de solicitud, ruta, estado y
              duración de la petición.
            </li>
          </ul>
          <p>
            No solicitamos datos personales
            sensibles para realizar un pedido.
            Burger Danlin no almacena números
            completos de tarjeta ni CVV; esos
            datos permanecen con el proveedor
            de pagos.
          </p>
        </section>

        <section>
          <h2>
            3. Finalidades del tratamiento
          </h2>
          <p>
            Los datos se utilizan para
            finalidades necesarias relacionadas
            con la compra:
          </p>
          <ul>
            <li>
              crear, identificar y administrar
              tu pedido;
            </li>
            <li>
              procesar, conciliar y, cuando
              corresponda, reembolsar pagos;
            </li>
            <li>
              coordinar preparación, punto de
              entrega y entrega del pedido;
            </li>
            <li>
              contactarte sobre incidencias,
              cambios o soporte de tu pedido;
            </li>
            <li>
              controlar capacidad, inventario
              y prevención de duplicados;
            </li>
            <li>
              prevenir fraude, abuso y accesos
              no autorizados;
            </li>
            <li>
              diagnosticar errores y mantener
              la seguridad y disponibilidad
              del servicio;
            </li>
            <li>
              atender obligaciones legales,
              financieras o requerimientos
              válidos de autoridad.
            </li>
          </ul>
          <p>
            Actualmente no utilizamos los datos
            del pedido para publicidad o
            marketing directo. Si en el futuro
            se agrega una finalidad secundaria,
            se actualizará este aviso y se
            solicitará el consentimiento que
            corresponda.
          </p>
        </section>

        <section>
          <h2>
            4. Limitar uso o divulgación
          </h2>
          <p>
            Puedes solicitar la limitación del
            uso o divulgación de tus datos
            escribiendo a{" "}
            <a
              href={
                "mailto:" +
                privacy.email
              }
            >
              {privacy.email}
            </a>
            . La solicitud debe indicar qué uso
            o divulgación deseas limitar y un
            medio para comunicarte la respuesta.
          </p>
        </section>

        <section>
          <h2>5. Derechos ARCO</h2>
          <p>
            Puedes solicitar acceso,
            rectificación, cancelación u
            oposición respecto de tus datos
            personales enviando una solicitud a{" "}
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
          <p>
            Incluye tu nombre, el derecho que
            deseas ejercer, una descripción
            clara de los datos relacionados y
            un medio de contacto. Cuando sea
            necesario podremos solicitar
            información razonable para verificar
            tu identidad y evitar que otra
            persona acceda a tus datos.
          </p>
        </section>

        <section>
          <h2>
            6. Revocación del consentimiento
          </h2>
          <p>
            Cuando el tratamiento dependa de tu
            consentimiento, puedes solicitar su
            revocación mediante el mismo correo.
            La revocación no afecta tratamientos
            que deban continuar por una
            obligación legal, contractual,
            financiera, de seguridad o para
            atender una disputa pendiente.
          </p>
        </section>

        <section>
          <h2>
            7. Proveedores y transferencias
          </h2>
          <p>
            Para operar el servicio podemos
            utilizar proveedores tecnológicos
            que intervienen en pagos,
            infraestructura, alojamiento,
            respaldo y seguridad. Solo se
            comparte la información necesaria
            para la función correspondiente y
            bajo controles de seguridad.
          </p>
          <p>
            Cuando se habilitan pagos reales,
            Mercado Pago procesa la operación
            de pago conforme a sus propias
            condiciones y avisos de privacidad.
            También podremos comunicar datos a
            una autoridad cuando exista un
            requerimiento legal válido.
          </p>
        </section>

        <section>
          <h2>
            8. Almacenamiento técnico y
            cookies
          </h2>
          <p>
            El sitio utiliza almacenamiento
            técnico necesario para conservar de
            forma temporal el acceso a tu
            pedido durante la sesión del
            navegador. No usamos cookies de
            publicidad de terceros en el flujo
            de compra actual.
          </p>
        </section>

        <section>
          <h2>
            9. Seguridad y conservación
          </h2>
          <p>
            Aplicamos medidas técnicas y
            organizativas para reducir el riesgo
            de acceso, pérdida, alteración o
            divulgación no autorizada. Entre
            ellas se incluyen controles de
            acceso, registros de auditoría,
            cifrado de respaldos y minimización
            de datos.
          </p>
          <p>
            Los datos se conservan solo durante
            el tiempo necesario para la
            operación, soporte, conciliación,
            seguridad y obligaciones aplicables.
            Los plazos pueden ampliarse cuando
            exista una disputa de pago,
            investigación, incidente de
            seguridad o requerimiento legal.
          </p>
        </section>

        <section>
          <h2>
            10. Cambios al aviso
          </h2>
          <p>
            Las modificaciones a este aviso se
            publicarán en esta misma página.
            La fecha de actualización ubicada al
            inicio permite identificar la
            versión vigente.
          </p>
        </section>

        <section>
          <h2>11. Contacto</h2>
          <p>
            Responsable:{" "}
            <strong>
              {privacy.responsible}
            </strong>
            .
            <br />
            Domicilio:{" "}
            <strong>
              {privacy.address}
            </strong>
            .
            <br />
            Correo de privacidad:{" "}
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
    </main>
    <SiteFooter seller={seller} />
    </>
  );
}
