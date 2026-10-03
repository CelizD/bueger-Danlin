# Estado final del MVP — Burger Danlin

Fecha de corte: **3 de octubre de 2026**

Este documento es la fuente resumida de verdad para el estado funcional del MVP. Los documentos de auditoría más antiguos deben leerse como snapshots históricos y no como lista vigente de pendientes.

## 1. Estado general

**Código del MVP: completo.**

El flujo principal está implementado y validado en CI:

`cliente → pedido → pago → cocina → READY → QR → entrega → DELIVERED`

El repositorio también cubre cancelación, reembolso, pagos tardíos, entrega grupal, comprobante PDF, correo de confirmación, privacidad, derechos ARCO, consentimiento para menores, administración, observabilidad preparada, backups y retención técnica.

Lo pendiente para abrir tráfico real ya no es desarrollo funcional principal. Se concentra en **infraestructura, credenciales/proveedores y validación operativa en producción**.

## 2. Reglas vigentes del negocio

- Combo hamburguesa + papas: **$130 MXN**.
- Máximo configurable por evento; baseline inicial: **50 combos**.
- Zona horaria: **America/Tijuana**.
- Cierre operativo inicial: viernes **9:00 p. m.**
- Entrega inicial: sábado **9:30 a. m.**
- Punto inicial: **Universidad**.
- Se permiten varios combos por pedido.
- El backend recalcula y valida precios.
- Una reserva pendiente dura **15 minutos**.
- Solo los **combos pagados** cuentan para la meta de entrega grupal gratis.
- Si no se alcanza la meta, el costo de traslado se divide entre los pedidos pagados y se cobra al entregar.
- Un punto de entrega requiere nombre, dirección exacta, latitud y longitud antes de poder recibir pedidos.

## 3. Cliente / checkout

Implementado:

- catálogo e inventario;
- múltiples combos personalizados;
- extras y bebidas;
- pickup event activo;
- ubicación exacta del punto;
- progreso de entrega grupal;
- nombre y teléfono obligatorios;
- correo opcional;
- aceptación de términos de compra;
- aceptación independiente de condiciones de entrega grupal;
- aviso simplificado de privacidad;
- confirmación de mayoría de edad o autorización de madre/padre/tutor;
- idempotencia al crear pedido;
- reserva de inventario/capacidad;
- administración segura del pedido mediante cookie HttpOnly aislada por pedido;
- cancelación antes del corte según reglas vigentes;
- comprobante PDF descargable;
- correo de confirmación de compra cuando SMTP está habilitado.

## 4. Pagos

Proveedor definido para el MVP: **Mercado Pago**.

Implementado en código:

- creación de checkout;
- validación HMAC del webhook;
- ventana anti-replay;
- deduplicación persistente;
- recuperación de eventos `PROCESSING` abandonados;
- reconciliación canónica contra la API de Mercado Pago;
- transiciones de pago protegidas contra regresiones;
- protección ante pago recibido después de expirar/cerrar la reserva;
- caso de pago tardío visible para administración;
- reembolso total idempotente;
- cancelación/reembolso del pedido;
- kill switch `ENABLE_REAL_PAYMENTS`.

Antes de habilitar pagos reales:

1. configurar credenciales reales/sandbox;
2. registrar el webhook HTTPS;
3. ejecutar pago end-to-end con Mercado Pago;
4. validar reintentos/idempotencia;
5. probar pago fallido;
6. probar cancelación y refund reales;
7. activar `ENABLE_REAL_PAYMENTS=true` únicamente después de esas pruebas.

## 5. Entrega grupal

Implementado:

- meta medida por **combos pagados**;
- pedidos cancelados/reembolsados dejan de contar;
- validación para impedir una meta superior a la capacidad del evento;
- costo total de traslado configurable;
- estimación del costo individual;
- consentimiento explícito del cliente;
- visualización en Admin;
- notificaciones grupales preparadas mediante Telegram;
- panel del día.

## 6. Cocina y entrega

### Cocina

Ruta: `/admin/cocina`

Flujo:

`PAID/CONFIRMED → PREPARING → READY`

Roles:

- `ADMIN`
- `KITCHEN`

### Entrega

Ruta: `/admin/entrega`

QR:

`BD1:<orderCode>:<verificationToken>`

El token se valida contra un hash en servidor. Un QR reutilizado no produce una segunda entrega.

Roles:

- `ADMIN`
- `DELIVERY`

## 7. Administración

Rutas principales:

- `/admin/dashboard`
- `/admin/pedidos`
- `/admin/sabados`
- `/admin/inventario`
- `/admin/personal`
- `/admin/cocina`
- `/admin/entrega`
- `/admin/arco`

Incluye:

- dashboard;
- pedidos;
- sábados/puntos de entrega;
- configuración de entrega grupal;
- inventario;
- personal y roles;
- cocina;
- entrega QR;
- pagos tardíos y resolución/reembolso;
- solicitudes ARCO;
- AuditLog.

## 8. Privacidad y legal

Implementado:

- Aviso de Privacidad integral: `/privacidad`;
- Términos de compra: `/terminos`;
- mecanismo público ARCO: `/arco`;
- folio por solicitud ARCO;
- bandeja administrativa ARCO;
- verificación de identidad pendiente antes de hacer efectivo el derecho;
- sin carga pública de INE/pasaporte;
- aviso y consentimiento para menores;
- identidad pública del vendedor y medios de soporte;
- términos versión vigente: **2026-09-30-v3**;
- aviso de edad/autorización versión: **2026-09-30-v1**.

Datos de producción que deben ser reales antes de lanzar:

- `PRIVACY_RESPONSIBLE`
- `PRIVACY_ADDRESS`
- `PRIVACY_EMAIL`
- `BUSINESS_LEGAL_NAME`
- `BUSINESS_TRADE_NAME`
- `BUSINESS_RFC`
- `BUSINESS_ADDRESS`
- `SUPPORT_PHONE`
- `SUPPORT_EMAIL`

## 9. Retención

La retención técnica está implementada con:

- dry-run;
- kill switch;
- timer preparado;
- anonimización de PII;
- purga de registros técnicos según política;
- protección fiscal del núcleo financiero.

Regla importante:

- nombre/teléfono/email pueden anonimizarse cuando dejen de ser necesarios;
- evidencia financiera de pedidos/pagos completados no se elimina automáticamente;
- `PAID`, `REFUNDED` y `PARTIALLY_REFUNDED` están protegidos del cleanup destructivo de metadata;
- no se calcula “5 años desde la compra”; la política fiscal debe anclarse a la declaración relacionada.

Antes de activar cleanup destructivo en producción todavía debe confirmarse con contador:

- régimen fiscal;
- calendario de declaraciones;
- estrategia de CFDI individual/global.

## 10. Correo

Implementado:

- outbox persistente;
- deduplicación;
- reintentos;
- recuperación de claims atascados;
- SMTP con STARTTLS/TLS;
- comprobante PDF adjunto;
- auditoría del envío;
- timer/servicio preparado.

Producción requiere configurar y probar SMTP antes de habilitar:

`EMAIL_NOTIFICATIONS_ENABLED=true`

## 11. Seguridad

Implementado y cubierto por el pipeline actual:

- Argon2id;
- MFA obligatorio para ADMIN;
- TOTP + recovery codes;
- sesiones revocables server-side;
- RBAC;
- CSRF;
- CORS;
- CSP;
- HSTS;
- Helmet;
- límites de body;
- rate limiting;
- lockout;
- logs estructurados sin secretos;
- AuditLog;
- Gitleaks;
- Semgrep;
- `pnpm audit`;
- CycloneDX SBOM;
- Trivy para API/Web/Backup;
- Docker non-root;
- DB/Redis no públicos en Compose de producción;
- secretos fuera de Git.

Dependabot quedó limpio al cierre del MVP:

- Next.js **16.3.5**;
- `class-validator` **0.15.1**;
- `@nestjs/throttler` **6.7.0**;
- `pnpm/action-setup` **6.1.0**;
- `anchore/sbom-action` **0.24.2**;
- majors de TypeScript/Vitest diferidos para después del MVP.

## 12. CI / calidad

`.github/workflows/ci.yml` valida:

1. instalación con frozen lockfile;
2. Prisma generate;
3. migraciones;
4. TypeScript;
5. tests;
6. build;
7. seed E2E;
8. Playwright;
9. E2E integrado.

`.github/workflows/security.yml` valida:

- dependency audit;
- Gitleaks;
- Semgrep;
- SBOM;
- Trivy API;
- Trivy Web;
- Trivy Backup.

Estado de cierre del MVP: **CI verde + Security verde**.

## 13. Infraestructura preparada en repo

Ya existe configuración para:

- Docker Compose de producción;
- Nginx;
- HTTPS enforcement;
- health/readiness;
- backups cifrados con `age`;
- checksum SHA-256;
- restore drill;
- offsite S3-compatible;
- Object Lock/Versioning checks;
- systemd timers;
- Prometheus;
- Loki;
- Grafana;
- Alloy;
- Tempo;
- tracing OTLP/OpenTelemetry-compatible del API;
- Node Exporter;
- preflight;
- go-live gate;
- runbooks de incidentes versionados;
- workflow DAST de staging preparado con OWASP ZAP.

## 14. Bloqueantes reales antes del lanzamiento

Estos son los pendientes de lanzamiento, no de funcionalidad del MVP:

### VPS / red

- contratar VPS;
- usuario deploy no-root;
- SSH por claves;
- firewall;
- Docker/Compose;
- Nginx;
- `production.env`;
- dominio y DNS;
- TLS real.

### Proveedores

- credenciales Mercado Pago;
- webhook HTTPS;
- pruebas sandbox/reales;
- SMTP real;
- bucket offsite real.

### Operación

- levantar observabilidad en VPS;
- configurar alertas;
- probar backups/restores reales;
- ejecutar preflight y go-live check;
- ejecutar benchmark Argon2id en hardware objetivo;
- confirmar retención fiscal con contador;
- asignar contactos reales de incidentes y ejecutar un tabletop;
- simular pérdida total del VPS y medir RPO/RTO.

## 15. No bloqueantes para este MVP

Son mejoras de madurez, no requisitos para abrir un MVP pequeño cuando los controles actuales están correctamente desplegados:

- WAF/CDN;
- ejecución DAST contra staging real (workflow ya preparado);
- pentest externo;
- load/stress testing avanzado;
- ADRs adicionales;
- staging más sofisticado;
- artifact signing;
- Kubernetes;
- microservicios.

Se deben priorizar conforme crezca tráfico, riesgo o complejidad.

## 16. Fuente de verdad

Orden recomendado de lectura:

1. **este documento** — estado final del MVP;
2. `docs/MVP.md` — reglas funcionales;
3. `deploy/GO_LIVE_CHECKLIST.md` — pasos para abrir producción;
4. `docs/RETENTION_POLICY.md` — retención;
5. `docs/DATA_INVENTORY.md` — inventario de datos;
6. `SECURITY_AUDIT.md` — auditoría de seguridad, considerando su fecha/snapshot.

Los audits de backend/frontend reflejan etapas anteriores del proyecto y no deben usarse solos para determinar qué falta hoy.
