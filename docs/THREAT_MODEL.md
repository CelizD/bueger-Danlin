# Threat Model — Burger Danlin

Fecha: 2026-09-27
Estado: baseline de seguridad para MVP

## 1. Alcance

Este documento modela amenazas para Burger Danlin en su arquitectura actual de un solo negocio:

- Next.js como cliente web;
- NestJS como API;
- PostgreSQL como fuente de verdad;
- Redis como infraestructura auxiliar;
- panel administrativo con roles ADMIN, KITCHEN y DELIVERY;
- pagos MOCK activos en desarrollo y arquitectura preparada para Mercado Pago/Stripe;
- despliegue previsto en VPS con Nginx y Docker.

No cubre multi-tenancy porque el producto actual no es SaaS multi-tenant.

## 2. Activos críticos

1. Datos de clientes: nombre, teléfono y correo opcional.
2. Pedidos, importes, estado, historial y asignaciones de inventario.
3. Datos de pagos y referencias externas del proveedor.
4. Credenciales de personal.
5. Secreto TOTP cifrado y códigos de recuperación MFA.
6. Tokens de sesión JWT.
7. Token opaco del pedido y token de verificación QR.
8. Secretos de infraestructura: DB, Redis, JWT, MFA, QR, proveedor de pagos y clave de backups.
9. Base PostgreSQL y backups cifrados.
10. Integridad del inventario, capacidad y estados de pedido.
11. AuditLog y logs operativos.
12. Pipeline CI/CD, imágenes Docker y dependencias.

## 3. Actores

### Legítimos

- Cliente que crea y consulta su pedido.
- ADMIN.
- KITCHEN.
- DELIVERY.
- GitHub Actions.
- Proveedor de pagos cuando sea activado.
- Operador del VPS.

### Adversarios considerados

- Usuario anónimo de Internet.
- Cliente intentando acceder o modificar pedidos ajenos.
- Cuenta de staff comprometida.
- Bot de credential stuffing/brute force.
- Atacante con acceso parcial a red o infraestructura.
- Dependencia o imagen comprometida.
- Actor con acceso accidental a logs/backups.
- Proveedor externo comprometido o respuesta maliciosa.

## 4. Trust boundaries

### Boundary A — Navegador ↔ Internet ↔ Web/API

Datos cruzan una red no confiable. En producción deben viajar por HTTPS.

Controles:
- HSTS;
- FORCE_HTTPS;
- CORS allowlist;
- CSRF para mutaciones de staff;
- CSP;
- límites de payload;
- rate limiting;
- validación de DTO.

### Boundary B — Web ↔ API

El frontend no es una autoridad de seguridad.

Controles:
- precio recalculado en backend;
- RBAC en servidor;
- cookie HttpOnly + SameSite=Strict por pedido para operaciones privadas del cliente;
- Idempotency-Key;
- validación server-side.

### Boundary C — API ↔ PostgreSQL

La base contiene PII, credenciales derivadas y estado crítico del negocio.

Controles:
- Prisma/queries parametrizadas;
- usuario runtime de mínimo privilegio;
- PostgreSQL sin puerto público en producción;
- SCRAM-SHA-256;
- transacciones y locks para inventario/capacidad.

### Boundary D — API ↔ Redis

Redis no forma parte actualmente del flujo crítico.

Controles:
- red privada Docker;
- contraseña;
- sin puerto público en producción.

### Boundary E — API ↔ proveedor de pagos

Se considera un sistema externo no confiable.

Controles actuales/preparados:
- kill switch ENABLE_REAL_PAYMENTS=false;
- timeouts;
- idempotencia;
- validación de respuesta;
- sanitización de errores;
- verificación de firma de webhook preparada.

Pendiente antes de activar pagos:
- webhook persistente;
- deduplicación;
- reconciliación;
- refunds reales;
- sandbox E2E.

### Boundary F — Infraestructura ↔ backups/offsite

Los backups contienen la base completa.

Controles:
- cifrado age;
- checksum SHA-256;
- clave privada separada;
- restore drill;
- Object Lock/Versioning preparados.

Pendiente:
- bucket real;
- prueba offsite real;
- política de retención aplicada y verificada.

### Boundary G — Código ↔ supply chain

Controles:
- lockfile;
- pnpm trust policy;
- acciones GitHub fijadas por SHA;
- Gitleaks;
- Semgrep;
- pnpm audit;
- SBOM;
- Trivy sobre imágenes de producción.

Pendiente:
- firma de artifacts/images;
- pipeline de release.

## 5. Amenazas principales

| ID | Amenaza | Impacto | Controles actuales | Riesgo residual |
|---|---|---|---|---|
| T01 | Credential stuffing contra staff | Acceso administrativo | Argon2id, rate limit, lockout persistente, MFA ADMIN | Medio |
| T02 | Robo de sesión | Operaciones con identidad de staff | HttpOnly, Secure, SameSite=Strict, HTTPS/HSTS prod, invalidación por credencial | Medio |
| T03 | CSRF en panel | Mutaciones no autorizadas | SameSite + Origin + Sec-Fetch-Site | Bajo |
| T04 | IDOR de pedidos | Exposición/modificación de pedido ajeno | capability HttpOnly aislada por pedido + QR separado solo para entrega | Bajo |
| T05 | Manipulación de precios | Fraude | Backend recalcula precio | Bajo |
| T06 | Repetición de requests | Pedidos/pagos duplicados | Idempotency-Key y claves únicas | Bajo |
| T07 | Sobreventa/concurrencia | Inventario/capacidad incorrectos | Transacciones y locks PostgreSQL | Bajo |
| T08 | Reutilización de QR | Doble entrega | Token verificado contra API + transición de estado idempotente | Bajo |
| T09 | SQL injection | Lectura/escritura arbitraria DB | Prisma y parámetros | Bajo |
| T10 | XSS | Robo de sesión/datos | React escaping, CSP prod, headers | Medio |
| T11 | SSRF | Acceso a red interna | No existe fetch arbitrario de URL; clientes externos son específicos | Bajo |
| T12 | Exposición DB/Redis | Compromiso total de datos | Sin puertos públicos, redes Docker, mínimo privilegio | Medio hasta validar VPS |
| T13 | Secret leak | Compromiso de servicios | .env ignorado, Gitleaks, secretos fuera del repo | Medio; falta Secret Manager |
| T14 | Backup robado | Exposición histórica de PII | age encryption + permisos + checksum | Medio hasta validar offsite |
| T15 | Dependencia vulnerable | RCE/compromiso supply chain | audit, Semgrep, SBOM, Trivy, lockfile | Medio |
| T16 | Imagen vulnerable | Compromiso runtime | Trivy HIGH/CRITICAL corregibles | Bajo/Medio |
| T17 | Webhook falso/replay | Pago marcado incorrectamente | firma preparada | Alto hasta implementar persistencia/dedupe |
| T18 | Logs con PII/secretos | Fuga secundaria | logs sin body/cookies; telemetría limitada | Bajo/Medio |
| T19 | Abuso de endpoints caros | DoS/costo | rate limit global/login | Medio; falta load test y límites específicos |
| T20 | Cuenta ADMIN comprometida | Control amplio | MFA obligatorio + AuditLog | Medio |
| T21 | Cambio malicioso en main | Supply-chain/deploy | CI/Security | Medio; branch protection no verificada |
| T22 | Pérdida total del VPS | Indisponibilidad/pérdida de datos | backups/restore scripts | Medio/Alto hasta simulacro real |

## 6. Escenarios de abuso prioritarios

### A. Consultar un pedido ajeno

Un atacante adivina un orderCode.

Mitigación:
- orderCode por sí solo no concede acceso;
- se exige X-Order-Token;
- el token no se almacena en claro.

### B. Duplicar pedidos

Un cliente reenvía POST /orders por error o intencionalmente.

Mitigación:
- Idempotency-Key;
- requestHash;
- constraint única;
- backend valida coherencia del replay.

### C. Forzar sobreventa

Dos clientes compran el último stock simultáneamente.

Mitigación:
- transacción;
- bloqueo de filas;
- reserva explícita;
- liberación idempotente.

### D. Tomar una cuenta de ADMIN

Mitigación:
- Argon2id;
- lockout;
- MFA obligatorio;
- recovery codes one-time;
- sesiones invalidadas tras cambio de credencial.

### E. Falsificar confirmación de pago

Riesgo principal cuando se habiliten pagos reales.

Requisitos antes de activar:
- validación de firma;
- almacenamiento del event ID;
- deduplicación persistente;
- consulta/reconciliación contra proveedor;
- máquina de estados estricta;
- pruebas replay/out-of-order.

## 7. Riesgos aceptados temporalmente

1. Secretos gestionados mediante variables/archivo protegido en lugar de Vault/KMS.
2. Sin WAF/CDN hasta contar con infraestructura real.
3. DAST automatizado pero sin ejecución real hasta contar con staging HTTPS autorizado.
4. Sin tracing/métricas centralizadas.
5. Sin firma de imágenes.
6. Branch protection no verificable desde la integración actual.
7. Pagos reales deshabilitados hasta cerrar los controles de proveedor.
8. Benchmark Argon2id pendiente del hardware de producción.

## 8. Criterios para revisar este threat model

Revisar cuando ocurra cualquiera de estos cambios:

- activación de pagos reales;
- incorporación de cuentas de clientes;
- conversión a multi-tenant/SaaS;
- subida de archivos;
- API pública para terceros;
- app móvil con nuevas credenciales/tokens;
- almacenamiento de direcciones u otros datos sensibles;
- cambio de proveedor de infraestructura;
- incidente de seguridad significativo.

## 9. Próximas mitigaciones

1. Política técnica de retención y borrado.
2. Observabilidad y alertas.
3. Asignar contactos reales de incidentes y ejecutar un tabletop de los runbooks versionados.
4. Load/stress test.
5. Desplegar staging y ejecutar baseline + full scan del workflow DAST preparado.
6. WAF/CDN y TLS real.
7. Secret Manager/KMS cuando la infraestructura lo justifique.
8. Firma de artifacts/images.
9. Validación completa de pagos.
10. Pentest prelaunch.
