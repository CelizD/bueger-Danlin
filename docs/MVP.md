# Reglas del MVP

Fecha de corte: **4 de octubre de 2026**

> Estado: reglas funcionales del MVP cerradas en código. Para el estado técnico completo y los pendientes reales de producción consulta `docs/MVP_FINAL_STATUS.md`.

## Venta
- Combo Hamburguesa + Papas: $130 MXN.
- Máximo 50 combos por evento.
- Entrega inicial: sábado 9:30 a. m.
- Punto: Universidad.
- Cierre: viernes 9:00 p. m.
- Varios combos por pedido.

## Ingredientes y personalización
La hamburguesa se arma por porciones exactas y el backend valida los límites aunque el request sea manipulado:

- Carne: **1 a 5** porciones.
- Queso: **1 a 5** porciones.
- Tocino: **0 a 5** porciones.
- Lechuga: **0 a 5** porciones.
- Tomate: **0 a 5** porciones.
- Cebolla blanca: **0 a 5** porciones.
- Pepinillos: **0 a 5** porciones.
- Aderezos booleanos **Sí/No**: ketchup, mostaza, mayonesa, chipotle y BBQ con chipotle.
- Cebolla caramelizada y papas extra permanecen como opciones adicionales del catálogo.

El preview visual refleja las cantidades seleccionadas. Una cantidad `0` oculta el ingrediente y las combinaciones de aderezos conservan su representación visual cuando existe un SVG correspondiente.

## Extras y precios
- Carne extra +$30 por porción adicional.
- Queso extra +$10 por porción adicional.
- Tocino extra +$15 por porción adicional.
- Lechuga, tomate, cebolla blanca y pepinillos no agregan un precio nuevo en el MVP actual.
- Ketchup, mostaza, mayonesa, chipotle y BBQ con chipotle no agregan un precio nuevo en el MVP actual.
- Papas extra +$25.
- Coca-Cola lata $30.

El frontend muestra el precio estimado en tiempo real, pero el backend vuelve a calcularlo y es la autoridad final. Las cantidades reales también se usan para reservar/descontar inventario y se conservan en Cocina, Admin, vista del cliente, comprobante PDF y correo de compra.

## Cliente
Nombre y teléfono obligatorios. Correo opcional. +52 por defecto.

## Pago
- El pago es obligatorio para que un pedido cuente como confirmado.
- Mock se usa en local/CI.
- Proveedor definido para producción: **Mercado Pago**.
- La integración incluye checkout, webhook firmado, deduplicación persistente, reconciliación canónica, reembolso total idempotente y protección ante pagos tardíos.
- `ENABLE_REAL_PAYMENTS=false` permanece como kill switch hasta probar credenciales/webhook/sandbox en infraestructura real.
- Stripe no forma parte del alcance del MVP actual.

## Cancelación
Permitida antes del cierre. Después del cierre no hay cancelación automática.


## Envío grupal
- La meta de envío gratis se mide por combos pagados, no por cantidad de pedidos.
- Solo cuentan combos de pedidos con pago confirmado y vigentes.
- Pedidos cancelados o reembolsados no cuentan para la meta.
- Si se alcanza la meta de combos, el envío queda gratis.
- Si no se alcanza, el costo de traslado se divide entre los pedidos pagados y se cobra al entregar.


## Ubicación de entrega
- Todo punto nuevo debe tener nombre, dirección exacta, latitud y longitud.
- Un punto heredado sin ubicación completa no puede abrir pedidos hasta corregirse.
- Los puntos incompletos no se muestran a clientes.
- El cliente puede abrir el pin exacto desde la selección del punto y desde su pedido.


## Privacidad
- El checkout muestra un aviso de privacidad simplificado antes de enviar datos personales.
- El aviso integral está disponible en `/privacidad`.
- El aviso cubre nombre, teléfono, correo opcional, datos del pedido, pago y datos técnicos de seguridad.
- El flujo actual no usa los datos del pedido para marketing directo.
- En producción son obligatorios `PRIVACY_RESPONSIBLE`, `PRIVACY_ADDRESS` y `PRIVACY_EMAIL`.
- El go-live check impide lanzar si faltan identidad, domicilio o correo de privacidad/ARCO.
- Existe un mecanismo público en `/arco` para presentar solicitudes de Acceso, Rectificación, Cancelación u Oposición.
- Cada solicitud genera un folio y queda en estado de verificación de identidad pendiente.
- No existe consulta pública de solicitudes por folio.
- El detalle solo es visible para ADMIN autenticado con MFA en `/admin/arco`.
- El formulario no almacena identificaciones oficiales; la acreditación de identidad o representación se coordina después por un canal controlado.
- AuditLog registra recepción/cambios de estado sin copiar nombre, correo ni descripción completa.


## Términos de compra
- Los términos integrales están disponibles en `/terminos`.
- El cliente debe aceptarlos explícitamente antes de crear un pedido.
- Cada pedido guarda `purchaseTermsAcceptedAt` y `purchaseTermsVersion`.
- Versión inicial: `2026-09-29-v1`; versión vigente tras incorporar identidad pública del vendedor: `2026-09-29-v2`.
- La política documenta reserva de 15 minutos, pago, entrega grupal, cancelación antes del corte, reembolso y derechos del consumidor.
- La aceptación de términos de compra es independiente de la aceptación de condiciones de entrega grupal.
- Versión vigente de términos tras incorporar la confirmación de edad/autorización: `2026-09-30-v3`.


## Menores de edad
- Antes de crear un pedido, el cliente debe confirmar expresamente que es mayor de edad o, si es menor de 18 años, que cuenta con autorización de su madre, padre o tutor.
- El backend exige `ageAuthorizationConfirmed=true`; no basta con ocultar o saltarse el checkbox del frontend.
- Cada pedido guarda `ageAuthorizationConfirmedAt` y `ageAuthorizationVersion`.
- Versión inicial del aviso: `2026-09-30-v1`.
- El flujo no solicita fecha de nacimiento, identificación ni datos adicionales del adulto responsable.
- El aviso integral de privacidad explica el tratamiento aplicable a menores.


## Datos del vendedor y soporte
- El checkout muestra antes del pago el nombre legal del vendedor, nombre comercial, RFC, domicilio y medios de soporte.
- El footer público mantiene visibles esos datos y enlaces a `/terminos` y `/privacidad`.
- Los datos también permanecen accesibles desde `Administrar mi pedido`.
- Producción exige `BUSINESS_LEGAL_NAME`, `BUSINESS_TRADE_NAME`, `BUSINESS_RFC`, `BUSINESS_ADDRESS`, `SUPPORT_PHONE` y `SUPPORT_EMAIL`.
- El `go-live-check` bloquea el lanzamiento si faltan esos datos o si teléfono/correo/RFC no cumplen validaciones básicas.


## Comprobante de compra
- Cada pedido puede descargar un comprobante PDF desde `Administrar mi pedido`.
- El endpoint `GET /orders/:orderCode/receipt` exige la cookie HttpOnly de acceso del pedido; el token QR no autoriza descargar comprobantes.
- El PDF incluye folio, fecha, estado del pedido/pago, vendedor, RFC, domicilio, soporte, detalle de productos, total, punto de entrega y situación del traslado grupal.
- El comprobante separa el total del pedido del posible traslado en efectivo.
- El documento se identifica expresamente como comprobante informativo y no como CFDI/factura fiscal.
- El comprobante permanece disponible para estados terminales como entregado, cancelado o reembolsado mientras el pedido permanezca en el sistema.


## Confirmación por correo
- Cuando un pago queda confirmado y el pedido tiene correo, se crea una notificación de compra persistente.
- La entrega usa outbox para evitar duplicados.
- Existen reintentos y recuperación de trabajos atascados.
- El correo adjunta el comprobante PDF de compra.
- SMTP usa TLS/STARTTLS en producción y verificación de certificado.
- El flujo SMTP completo está validado en CI con Mailpit, incluyendo asunto, destinatario, cuerpo y PDF adjunto.
- `EMAIL_NOTIFICATIONS_ENABLED=false` debe permanecer en producción hasta configurar y probar SMTP real.


## Pagos tardíos
- Una reserva expirada libera inventario/capacidad y no revive aunque el proveedor confirme el pago después.
- Un pago confirmado después del cierre/expiración se registra como caso tardío.
- Admin puede identificar el caso y resolver/reembolsar sin reasignar inventario automáticamente.
- La protección está cubierta por lógica de webhook/reconciliación y auditoría.


## Calidad y supply chain
- CI integrado valida instalación frozen-lockfile, Prisma, migraciones, TypeScript, tests, build y E2E completo.
- Security valida Gitleaks, Semgrep, auditoría de dependencias, SBOM y Trivy en API/Web/Backup.
- Dependabot quedó limpio al cierre del MVP.
- Versiones de cierre relevantes: Next.js 16.3.5, class-validator 0.15.1 y @nestjs/throttler 6.7.0.
- Upgrades major de TypeScript y Vitest se difirieron explícitamente para después del MVP.


## Roles del personal
- `ADMIN`: control completo de la operación: Dashboard, Pedidos, Cocina, Entrega, Agenda, Inventario, ARCO y Personal.
- `KITCHEN`: solo Cocina.
- `DELIVERY`: solo Entrega.
- La separación se valida tanto en navegación como en API: un rol fuera de su área recibe redirección o `403` según corresponda.
