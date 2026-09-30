# Política Técnica de Retención y Eliminación — Burger Danlin

Fecha: 2026-09-30
Estado: baseline técnica + piso fiscal federal revisado; validación del régimen fiscal/CFDI del negocio e infraestructura real pendiente

## 1. Objetivo

Reducir el tiempo durante el cual datos personales, logs, secretos derivados y backups permanecen disponibles, sin romper operación, auditoría o recuperación.

Esta es una política técnica de ingeniería. Los plazos legales/fiscales aplicables al negocio deben validarse antes de producción y prevalecen cuando exijan una conservación mayor.

## 2. Principios

1. Conservar únicamente lo necesario.
2. Separar datos operativos de logs.
3. No conservar secretos temporales más tiempo del necesario.
4. Eliminar mediante procesos repetibles y auditables.
5. Los backups tienen su propio ciclo de expiración.
6. Una solicitud de borrado debe considerar copias activas y el ciclo natural de backups.
7. No borrar registros sujetos a obligación legal, disputa, chargeback o investigación activa.

## 3. Baseline de retención técnica

| Categoría | Retención objetivo | Acción |
|---|---:|---|
| Pedido PENDING_PAYMENT expirado sin pago | 30 días | eliminar/anonimizar pedido y cliente si no tiene otros pedidos |
| Pedido FAILED/CANCELLED sin obligación posterior | 90 días | eliminar/anonimizar PII; conservar métricas agregadas |
| PII de cliente asociada a pedido PAID/DELIVERED/REFUNDED | 12 meses como baseline técnica | anonimizar nombre/teléfono/email cuando ya no sean necesarios, sin borrar evidencia financiera/fiscal |
| Núcleo fiscal de pedido pagado/reembolsado | mínimo legal aplicable; CFF art. 30 establece 5 años desde la declaración relacionada | **no se elimina automáticamente** porque la app no conoce la fecha de presentación/debimiento de la declaración |
| Payment completado/refund | conservar provider, externalId, status, amount, currency, paidAt/refundedAt y evidencia técnica necesaria | metadata de pagos completados/reembolsados queda protegida del cleanup automático hasta contar con ancla fiscal por declaración |
| Customer sin pedidos relacionados | 30 días | eliminar |
| Payment técnico no completado | 90 días | eliminar salvo investigación/reconciliación |
| PaymentWebhookEvent procesado/ignorado | 90 días | eliminar; conservar FAILED hasta resolver/reintentar |
| AuditLog | 12 meses | purgar o archivar con acceso restringido |
| HTTP access/error logs | 30 días | rotar y eliminar |
| Frontend telemetry | 30 días | rotar y eliminar |
| Failed login/security audit events | 180 días | eliminar salvo incidente |
| MFA recovery hashes no usados | mientras cuenta/MFA estén activos | eliminar al regenerar/desactivar |
| MFA secret cifrado | mientras MFA esté activo | eliminar al desactivar/eliminar cuenta |
| Staff desactivado | 12 meses baseline | anonimizar/eliminar datos no requeridos; conservar auditoría mínima |
| Backup local cifrado | 7 días | rotación automática objetivo |
| Backup offsite cifrado | 30 días baseline | Object Lock/Versioning según política final |
| Artifacts CI/SBOM | 90 días o política GitHub | expirar según necesidad operativa |
| Solicitud ARCO | mientras esté abierta + 12 meses después del cierre como baseline técnica | restringir acceso; revisar plazo legal definitivo antes de automatizar eliminación |

## 4. Piso fiscal federal — México

La revisión se hizo contra el **Código Fiscal de la Federación vigente**, artículo 30.

Regla general:
- la contabilidad y documentación relacionada con obligaciones fiscales deben conservarse **cinco años**;
- el cómputo inicia desde la fecha en que se presentó o debió presentarse la declaración relacionada, no necesariamente desde la fecha de la venta;
- si los efectos fiscales se prolongan en el tiempo o existe recurso/juicio, el punto de inicio cambia conforme al propio artículo 30;
- ciertos documentos corporativos de personas morales tienen conservación por todo el tiempo en que subsista la sociedad o contrato. Esos documentos no viven en Burger Danlin y deben administrarse fuera de esta aplicación.

### Decisión técnica para Burger Danlin

La aplicación no conoce todavía:
- régimen fiscal del contribuyente;
- fecha real o fecha límite de la declaración relacionada con cada operación;
- si una operación quedó incluida en CFDI individual o CFDI global;
- si existe declaración complementaria o controversia fiscal.

Por eso **no se calcula un “borrar a los 5 años desde la compra”**. Sería jurídicamente incorrecto.

Mientras no exista una ancla fiscal confiable:
1. `Order`, `OrderItem` y el núcleo financiero de `Payment` de operaciones pagadas/reembolsadas no se eliminan por el cleanup automático;
2. `Payment.metadata` de estados `PAID`, `REFUNDED` y `PARTIALLY_REFUNDED` tampoco se limpia automáticamente;
3. la PII directa del cliente puede anonimizarse antes cuando ya no sea necesaria para operación, soporte, derechos del consumidor, ARCO, facturación, disputa o una obligación legal;
4. una futura función de borrado fiscal deberá usar una fecha derivada de la declaración/obligación correspondiente, no `createdAt` del pedido.

### Protección de datos

La LFPDPPP vigente exige suprimir datos personales cuando dejan de ser necesarios, previo bloqueo cuando corresponda, una vez concluido el plazo de conservación aplicable. Por eso el piso fiscal se aplica al **núcleo contable/financiero**, no como excusa para conservar indefinidamente nombre, teléfono o correo del cliente.

La ley también prevé un plazo de 72 meses para datos relativos al incumplimiento de obligaciones contractuales. La política técnica no debe superar ese plazo para ese tipo de dato salvo otra obligación legal aplicable.

## 5. Anonimización de pedidos históricos

Cuando un pedido ya no requiera PII pero sí se quiera conservar información estadística:

- reemplazar nombre por valor neutro;
- eliminar teléfono;
- eliminar email;
- eliminar metadata de pago no necesaria;
- conservar:
  - importes;
  - productos;
  - cantidades;
  - estado;
  - fechas;
  - pickup event;
  - métricas operativas.

La anonimización debe ser irreversible desde la base activa.

## 6. Datos de autenticación

### Contraseñas

Solo se conserva hash Argon2id.

Al eliminar definitivamente una cuenta:
- eliminar passwordHash junto con la cuenta.

### MFA

Al regenerar recovery codes:
- los hashes anteriores dejan de ser válidos y deben reemplazarse.

Al desactivar/eliminar MFA:
- borrar mfaSecretEncrypted;
- borrar recovery hashes;
- borrar mfaLastUsedStep;
- borrar mfaEnrolledAt cuando corresponda.

### Sesiones

Los JWT/cookies no se guardan en texto en la base. Se persiste únicamente `StaffSession` con ID opaco, usuario, versión de credencial, expiración y revocación.
Logout marca `revokedAt` y el guard rechaza inmediatamente la sesión aunque el JWT aún no haya expirado.

## 7. Logs

Los logs operativos deben usar rotación y no convertirse en almacenamiento histórico ilimitado.

Objetivo:
- hot logs: hasta 30 días;
- seguridad relevante: hasta 180 días cuando se copie a un registro de seguridad/auditoría;
- incidentes: conservar evidencia mientras el incidente esté abierto y aplicar borrado posterior documentado.

No se deben copiar bodies, cookies o secretos a logs para compensar una retención corta.

## 8. Backups

La eliminación en la base activa no implica borrado inmediato dentro de backups ya cifrados.

Regla:
- los backups expiran por rotación;
- no se modifican dumps históricos individualmente;
- al restaurar un backup antiguo por desastre, se debe volver a aplicar cualquier cola/lista de borrados vigente antes de reabrir servicio cuando sea razonablemente posible.

Objetivo inicial:
- local: 7 días;
- offsite: 30 días.

Cambiar estos plazos solo de forma documentada.

## 9. Legal hold / incident hold

Suspender el borrado de un conjunto concreto cuando exista:

- disputa de pago;
- investigación de fraude;
- incidente de seguridad;
- requerimiento legal válido;
- necesidad de reconciliación financiera.

El hold debe:
- tener motivo;
- tener responsable;
- tener fecha de revisión;
- afectar el mínimo conjunto de datos posible.

## 10. Implementación

Implementado en el repositorio:

1. comando `pnpm retention:dry-run` sin mutaciones;
2. comando `pnpm retention:apply` protegido por `RETENTION_CLEANUP_ENABLED=true`;
3. anonimización de PII solo cuando todos los pedidos del Customer cumplen la ventana de retención;
4. limpieza de metadata limitada a pagos no completados (`PENDING`, `PROCESSING`, `FAILED`, `CANCELLED`); los pagos `PAID`, `REFUNDED` y `PARTIALLY_REFUNDED` quedan protegidos por el guard fiscal;
5. eliminación de Customers huérfanos vencidos;
6. purga de AuditLog general a 12 meses y eventos de login fallido/bloqueo a 180 días;
7. reporte sin mutación de pedidos operativos antiguos en estados `PAID`, `CONFIRMED`, `PREPARING` o `READY`;
8. tests de dry-run, ventanas de retención y aplicación;
9. servicio Docker de producción con usuario DB runtime de mínimo privilegio;
10. timer systemd diario preparado;
11. backup local alineado a 7 días;
12. purga de `PaymentWebhookEvent` procesados/ignorados a 90 días; los FAILED se conservan.

Las solicitudes ARCO no se incluyen todavía en el cleanup automático. No deben eliminarse mientras estén abiertas, durante verificación de identidad o mientras exista una controversia relacionada.

Pendiente antes de considerar el ciclo de vida completo cerrado:

1. mecanismo por registro para legal/incident hold;
2. política/automatización de cuentas de staff desactivadas;
3. retención centralizada de logs cuando exista backend de observabilidad;
4. verificación del Object Lock/retención offsite real;
5. alerta si el cleanup programado falla;
6. confirmar con contador el régimen fiscal, calendario de declaraciones y estrategia de CFDI/global antes de habilitar `RETENTION_CLEANUP_ENABLED=true` en producción;
7. implementar una ancla fiscal por declaración antes de crear cualquier borrado automático del núcleo contable.

Por estos puntos, el control global de retención sigue **parcial** hasta la validación de producción.

### Ejecución manual segura

Dry-run:

```bash
pnpm retention:dry-run
```

Aplicación explícita:

```bash
RETENTION_CLEANUP_ENABLED=true pnpm retention:apply
```

En producción, ejecutar primero dry-run y revisar el JSON antes de habilitar el timer.

## 11. Verificación

Mensualmente en producción:

- comprobar edad máxima de logs;
- comprobar edad máxima de backups;
- comprobar cantidad/edad de pedidos expirados;
- comprobar cuentas desactivadas antiguas;
- revisar crecimiento de AuditLog;
- ejecutar cleanup en dry-run y comparar;
- registrar excepciones/holds.

## 12. Cambios que requieren revisión

- facturación fiscal;
- programa de lealtad;
- marketing;
- cuentas de clientes;
- datos de envío;
- pagos reales;
- cambios regulatorios;
- nueva jurisdicción;
- nuevos proveedores;
- multi-tenancy.
