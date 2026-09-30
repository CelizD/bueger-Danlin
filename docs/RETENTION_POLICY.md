# Política Técnica de Retención y Eliminación — Burger Danlin

Fecha: 2026-09-27
Estado: baseline implementada para PII/AuditLog; validación de infraestructura y controles complementarios pendiente

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
| Pedido PAID/DELIVERED/REFUNDED | 12 meses como baseline técnica | luego anonimizar PII, sujeto a obligaciones legales/fiscales |
| Customer sin pedidos relacionados | 30 días | eliminar |
| Payment técnico no completado | 90 días | eliminar salvo investigación/reconciliación |
| Payment completado/refund | alineado al pedido/obligación financiera | eliminar metadata innecesaria antes |
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

## 4. Anonimización de pedidos históricos

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

## 5. Datos de autenticación

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

## 6. Logs

Los logs operativos deben usar rotación y no convertirse en almacenamiento histórico ilimitado.

Objetivo:
- hot logs: hasta 30 días;
- seguridad relevante: hasta 180 días cuando se copie a un registro de seguridad/auditoría;
- incidentes: conservar evidencia mientras el incidente esté abierto y aplicar borrado posterior documentado.

No se deben copiar bodies, cookies o secretos a logs para compensar una retención corta.

## 7. Backups

La eliminación en la base activa no implica borrado inmediato dentro de backups ya cifrados.

Regla:
- los backups expiran por rotación;
- no se modifican dumps históricos individualmente;
- al restaurar un backup antiguo por desastre, se debe volver a aplicar cualquier cola/lista de borrados vigente antes de reabrir servicio cuando sea razonablemente posible.

Objetivo inicial:
- local: 7 días;
- offsite: 30 días.

Cambiar estos plazos solo de forma documentada.

## 8. Legal hold / incident hold

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

## 9. Implementación

Implementado en el repositorio:

1. comando `pnpm retention:dry-run` sin mutaciones;
2. comando `pnpm retention:apply` protegido por `RETENTION_CLEANUP_ENABLED=true`;
3. anonimización de PII solo cuando todos los pedidos del Customer cumplen la ventana de retención;
4. limpieza de metadata de pagos asociada a datos anonimizados;
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
6. validación legal/fiscal de los plazos antes de habilitar `RETENTION_CLEANUP_ENABLED=true` en producción.

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

## 10. Verificación

Mensualmente en producción:

- comprobar edad máxima de logs;
- comprobar edad máxima de backups;
- comprobar cantidad/edad de pedidos expirados;
- comprobar cuentas desactivadas antiguas;
- revisar crecimiento de AuditLog;
- ejecutar cleanup en dry-run y comparar;
- registrar excepciones/holds.

## 11. Cambios que requieren revisión

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
