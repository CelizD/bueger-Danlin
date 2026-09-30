import { getPublicPrivacyConfig } from "@/features/privacy/privacy-config";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description:
    "Términos de compra, cancelación, entrega y reembolso de Burger Danlin.",
};

export default function TermsPage() {
  const business =
    getPublicPrivacyConfig();

  return (
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
        <h1>
          Términos y Condiciones
        </h1>
        <p>
          Versión 2026-09-29-v1 ·
          Actualizado el 29 de septiembre
          de 2026.
        </p>
      </header>

      {!business.configured &&
        process.env.NODE_ENV !==
          "production" && (
          <div
            className="privacy-dev-warning"
            role="status"
          >
            Configura los datos legales
            reales antes de producción.
          </div>
        )}

      <article className="privacy-document">
        <section>
          <h2>1. Quién vende</h2>
          <p>
            Las ventas realizadas mediante
            este sitio corresponden a{" "}
            <strong>
              {business.responsible}
            </strong>
            , con domicilio de contacto en{" "}
            <strong>
              {business.address}
            </strong>
            . Para aclaraciones relacionadas
            con estos términos puedes escribir
            a{" "}
            <a
              href={
                "mailto:" +
                business.email
              }
            >
              {business.email}
            </a>
            .
          </p>
        </section>

        <section>
          <h2>
            2. Productos, precios y moneda
          </h2>
          <p>
            Los productos, ingredientes,
            extras, cantidades disponibles y
            precios vigentes son los mostrados
            en el sitio al momento de crear el
            pedido. Los importes se expresan en
            pesos mexicanos (MXN).
          </p>
          <p>
            El servidor vuelve a validar
            precios, disponibilidad e inventario
            antes de crear el pedido. Si existe
            una diferencia o ya no hay
            disponibilidad suficiente, el
            pedido no se confirma.
          </p>
        </section>

        <section>
          <h2>
            3. Creación y reserva del pedido
          </h2>
          <p>
            Al enviar el formulario aceptas
            estos términos y las condiciones
            específicas de entrega grupal.
            Cuando el pedido se crea, el sistema
            genera un código único y reserva la
            capacidad e inventario durante
            aproximadamente 15 minutos para que
            completes el pago.
          </p>
          <p>
            Si el pago no se confirma dentro de
            ese periodo, la reserva puede vencer
            y el inventario puede liberarse.
          </p>
        </section>

        <section>
          <h2>4. Pago</h2>
          <p>
            En producción, los pagos en línea se
            procesan mediante el proveedor de
            pago habilitado en el sitio. Burger
            Danlin no almacena números completos
            de tarjeta ni CVV.
          </p>
          <p>
            Un pedido se considera pagado cuando
            el sistema recibe una confirmación
            válida del proveedor. Si el pago se
            confirma después de que la reserva
            venció o el pedido ya fue cerrado,
            el pedido no se reactiva y el pago
            se marca para reembolso.
          </p>
        </section>

        <section>
          <h2>5. Entrega grupal</h2>
          <p>
            Cada punto de entrega puede tener
            una meta mínima de combos pagados
            para desbloquear envío gratis.
          </p>
          <p>
            Si al cierre se alcanza la meta, el
            costo de traslado para los pedidos
            del grupo es $0. Si no se alcanza,
            el costo total de traslado
            configurado para ese evento se
            divide entre los pedidos pagados
            vigentes y la parte correspondiente
            se cobra en efectivo al momento de
            la entrega.
          </p>
          <p>
            El progreso y el estimado mostrado
            antes del cierre son informativos;
            el monto final se congela al cerrar
            el grupo conforme al número final de
            pedidos pagados.
          </p>
        </section>

        <section>
          <h2>
            6. Cancelación por el cliente
          </h2>
          <p>
            Mientras la fecha límite del punto
            de entrega no haya vencido, puedes
            cancelar desde{" "}
            <strong>
              Administrar mi pedido
            </strong>
            .
          </p>
          <ul>
            <li>
              Si el pedido todavía no está
              pagado, se cancela y se libera la
              capacidad reservada.
            </li>
            <li>
              Si el pedido ya está pagado, la
              cancelación inicia el reembolso
              correspondiente mediante el
              proveedor de pago.
            </li>
          </ul>
          <p>
            Después de la hora límite, la
            cancelación automática puede dejar
            de estar disponible porque la
            preparación y logística ya pueden
            haber comenzado. Esto no limita los
            derechos que correspondan por
            incumplimiento, producto defectuoso,
            cobro indebido u otros supuestos
            protegidos por la legislación
            aplicable.
          </p>
        </section>

        <section>
          <h2>7. Reembolsos</h2>
          <p>
            Cuando corresponda un reembolso, se
            enviará al mismo proveedor de pago
            utilizado para la compra. El sistema
            registra el estado del reembolso y,
            si el proveedor presenta una falla
            temporal, el caso permanece
            pendiente para reintento.
          </p>
          <p>
            El tiempo en que el dinero aparece
            nuevamente disponible puede depender
            del proveedor de pago y de la
            institución financiera del cliente.
          </p>
        </section>

        <section>
          <h2>
            8. Cancelación o incumplimiento de
            Burger Danlin
          </h2>
          <p>
            Si Burger Danlin cancela un pedido
            pagado o no puede cumplirlo por una
            causa atribuible al negocio, se
            gestionará la devolución del monto
            cobrado por el pedido, sin perjuicio
            de los demás derechos que resulten
            aplicables.
          </p>
          <p>
            Si recibes un producto incorrecto,
            incompleto o con un problema de
            calidad, comunícalo lo antes posible
            utilizando el medio de contacto
            indicado en este sitio para revisar
            el caso.
          </p>
        </section>

        <section>
          <h2>9. Entrega y código QR</h2>
          <p>
            Debes presentarte en el punto y
            horario indicados para recoger tu
            pedido. El QR o token asociado al
            pedido funciona como comprobante de
            entrega y no debe compartirse
            públicamente.
          </p>
          <p>
            La persona que presente un código
            válido podrá ser tratada por el
            sistema como autorizada para retirar
            el pedido.
          </p>
        </section>

        <section>
          <h2>
            10. Disponibilidad y cambios
          </h2>
          <p>
            La disponibilidad está limitada por
            inventario y capacidad de cada fecha
            de entrega. Burger Danlin puede
            cerrar pedidos cuando se alcance el
            límite, cuando venza la hora de
            cierre o cuando exista una causa
            operativa justificada.
          </p>
        </section>

        <section>
          <h2>
            11. Derechos del consumidor
          </h2>
          <p>
            Nada de estos términos pretende
            renunciar, restringir o sustituir
            derechos irrenunciables reconocidos
            por la legislación mexicana de
            protección al consumidor. En caso de
            contradicción, prevalecerán las
            disposiciones obligatorias
            aplicables.
          </p>
        </section>

        <section>
          <h2>
            12. Datos personales
          </h2>
          <p>
            El tratamiento de datos personales
            se describe en el{" "}
            <Link href="/privacidad">
              Aviso de Privacidad
            </Link>
            .
          </p>
        </section>

        <section>
          <h2>
            13. Cambios a estos términos
          </h2>
          <p>
            Cualquier modificación se publicará
            en esta misma página con una nueva
            fecha o versión. Cada pedido conserva
            en el sistema la versión de términos
            aceptada al momento de su creación.
          </p>
        </section>
      </article>
    </main>
  );
}
