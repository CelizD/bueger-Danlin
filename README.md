# Burger Danlin

Plataforma web de preventa de hamburguesas con pedidos programados para sábado, control de capacidad, inventario, cocina, entrega por QR y panel administrativo.

> **Estado del MVP al 3 de octubre de 2026:** código funcional completo y validado por CI/Security. Los pendientes reales antes de abrir tráfico son infraestructura, credenciales/proveedores y validación operativa en producción. Consulta `docs/MVP_FINAL_STATUS.md`.

## Estado actual

El flujo principal ya funciona de extremo a extremo con PostgreSQL, NestJS, Next.js y Playwright reales:

1. el cliente carga catálogo, fecha e inventario;
2. personaliza uno o varios combos;
3. captura nombre, teléfono y correo opcional;
4. el backend recalcula el precio;
5. se reserva capacidad e inventario durante 15 minutos;
6. el pago local `MOCK` cambia la orden a `PAID`;
7. Cocina mueve `PAID -> PREPARING -> READY`;
8. el cliente presenta un QR sin PII;
9. Entrega valida el QR contra el API;
10. la orden termina en `DELIVERED`.

Este flujo se ejecuta automáticamente en CI con una base PostgreSQL temporal.

## Producto inicial

- Combo hamburguesa + papas: **$130 MXN**
- Carne extra: **+$30**
- Queso extra: **+$10**
- Tocino extra: **+$15**
- Papas extra: **+$25**
- Coca-Cola en lata: **$30 MXN**

## Reglas de negocio

- Máximo **50 combos** por sábado.
- Cierre operativo esperado: **viernes 9:00 p. m.**
- Zona horaria: **America/Tijuana**.
- Punto inicial: **Universidad**.
- Pago obligatorio.
- Nombre y teléfono obligatorios.
- Correo opcional.
- Cada combo se personaliza de forma independiente.
- El backend es la autoridad del precio.
- Una orden pendiente reserva capacidad e inventario durante 15 minutos.
- Una reserva expirada libera automáticamente inventario y capacidad.
- Las cancelaciones antes del cierre liberan cupo e inventario.
- Los pagos `MOCK` cancelados se reembolsan de forma simulada e idempotente.

## Arquitectura

Burger Danlin se mantiene como **monolito modular**, suficiente para el MVP y más simple de operar que una arquitectura distribuida prematura.

- `apps/web`: Next.js + React + TypeScript
- `apps/api`: NestJS + TypeScript
- `packages/types`: tipos compartidos
- `database/prisma`: PostgreSQL + Prisma 7
- `docker-compose.yml`: PostgreSQL, Redis y Mailpit para desarrollo
- `docker-compose.prod.yml`: despliegue endurecido para producción
- `deploy/`: Nginx, backups, restore drills, preflight y documentación operativa

PostgreSQL es la fuente de verdad. Redis está preparado para infraestructura futura, pero no participa actualmente en el flujo crítico de pedidos.

## Funcionalidad implementada

### Cliente

- catálogo dinámico;
- fecha de entrega activa;
- disponibilidad de inventario;
- múltiples combos personalizados;
- extras y bebidas;
- precio estimado en frontend y precio final recalculado en backend;
- creación de pedidos idempotente;
- reserva de 15 minutos;
- pago local `MOCK`;
- QR de entrega;
- consulta segura del pedido mediante cookie HttpOnly aislada por pedido;
- cancelación y reembolso local simulado.

### Cocina

Ruta:

`/admin/cocina`

Rol permitido:

- `KITCHEN`

`ADMIN` no puede entrar a Cocina; la separación se aplica tanto en frontend como en API.

Flujo:

`PAID/CONFIRMED -> PREPARING -> READY`

### Entrega

Ruta:

`/admin/entrega`

Rol permitido:

- `DELIVERY`

`ADMIN` no puede entrar a Entrega; la separación se aplica tanto en frontend como en API.

El QR usa el formato:

`BD1:<orderCode>:<verificationToken>`

El API valida el token contra el hash almacenado. Un QR reutilizado no genera una segunda entrega.

### Administración

Rutas administrativas para `ADMIN`:

- `/admin/dashboard`
- `/admin/pedidos`
- `/admin/sabados`
- `/admin/inventario`
- `/admin/personal`
- `/admin/arco`

Áreas operativas separadas:

- `/admin/cocina` → `ADMIN` y `KITCHEN`;
- `/admin/entrega` → `ADMIN` y `DELIVERY`.

Incluye:

- dashboard de ventas;
- administración de sábados;
- inventario;
- cuentas de personal;
- roles `ADMIN`, `KITCHEN` y `DELIVERY`;
- historial de estados;
- gestión de solicitudes ARCO;
- pagos tardíos y flujo de resolución/reembolso;
- `AuditLog` para múltiples operaciones administrativas.

## Inventario y capacidad

El backend usa transacciones y locks de PostgreSQL para evitar sobreventa.

Artículos base:

- carne;
- queso;
- tocino;
- papas;
- Coca-Cola.

Flujo:

1. al crear una orden se bloquean las filas necesarias;
2. se valida stock;
3. se descuenta y se crea `InventoryAllocation=RESERVED`;
4. al pagar pasa a `COMMITTED`;
5. si la reserva vence o la orden se cancela, el stock regresa exactamente una vez.

La capacidad del evento también cuenta órdenes pagadas y reservas pendientes todavía vigentes.

## Autenticación y seguridad

El acceso del personal incluye:

- Argon2id con parámetros centralizados;
- blocklist local para contraseñas comunes/triviales al crear o restablecer cuentas;
- bloqueo persistente tras 5 intentos fallidos durante 15 minutos;
- JWT con algoritmo, issuer y audience explícitos;
- cookie HttpOnly;
- `Secure` + `SameSite=Strict` en producción;
- invalidación de sesiones después de cambio de contraseña;
- RBAC validado en servidor;
- MFA obligatorio para `ADMIN`;
- TOTP de 6 dígitos;
- secreto MFA cifrado con AES-256-GCM;
- códigos de recuperación de un solo uso.

Protecciones HTTP:

- Helmet;
- CSP en producción desde Next.js;
- HSTS;
- CORS restringido a `APP_ORIGIN`;
- protección CSRF para mutaciones autenticadas;
- límites explícitos de body;
- `FORCE_HTTPS`;
- error filter global;
- errores 5xx sin stack/SQL/rutas internas;
- `X-Request-Id`;
- logs HTTP estructurados sin bodies, cookies ni secretos;
- rate limiting global y reforzado en login.

Consulta `SECURITY_AUDIT.md` para el estado detallado.

Documentación de seguridad y privacidad técnica:

- `docs/THREAT_MODEL.md`
- `docs/DATA_INVENTORY.md`
- `docs/RETENTION_POLICY.md`

## Pagos

El proveedor definido para el MVP es **Mercado Pago**. En desarrollo y CI se mantiene `MockPaymentProvider`.

Desarrollo/tests:

```text
PAYMENT_PROVIDER=mock
ENABLE_REAL_PAYMENTS=false
```

Implementado en código:

- cliente de Mercado Pago Orders API;
- creación de checkout;
- webhook firmado con HMAC y ventana anti-replay;
- deduplicación persistente de eventos;
- recuperación de eventos `PROCESSING` abandonados;
- reconciliación canónica contra la API del proveedor;
- protección contra transiciones regresivas y pagos tardíos;
- reembolso total idempotente;
- cancelación/reembolso de pedido;
- `ENABLE_REAL_PAYMENTS=false` como kill switch global.

Antes de habilitar pagos reales todavía se debe:

1. configurar credenciales reales/sandbox;
2. registrar el webhook HTTPS;
3. ejecutar pago end-to-end con Mercado Pago;
4. probar reintentos/idempotencia;
5. probar pago fallido;
6. probar cancelación y refund reales;
7. activar `ENABLE_REAL_PAYMENTS=true` únicamente después de esas pruebas.

## Desarrollo local

### Requisitos

- Node.js >= 22.12
- pnpm 10
- Docker Desktop

### 1. Variables

PowerShell:

```powershell
Copy-Item .env.example .env
```

### 2. Infraestructura

```powershell
docker compose up -d
```

### 3. Dependencias

```powershell
pnpm install
```

### 4. Base de datos

```powershell
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Aplicación

```powershell
pnpm dev
```

## URLs locales

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- Liveness: `http://localhost:4000/api/v1/health/live`
- Readiness: `http://localhost:4000/api/v1/health/ready`
- Swagger UI: `http://localhost:4000/api/v1/docs`
- OpenAPI JSON: `http://localhost:4000/api/v1/docs-json`
- Mailpit: `http://localhost:8025`

La documentación OpenAPI se deshabilita en producción salvo que `ENABLE_API_DOCS=true`.

## API

Prefijo:

`/api/v1`

Endpoints públicos principales:

- `GET /catalog`
- `GET /pickup-events/current`
- `GET /inventory/availability`
- `POST /orders`
- `GET /orders/:orderCode`
- `POST /orders/:orderCode/cancel`
- `POST /payments/mock/:orderCode/confirm`

El endpoint de creación requiere el header `Idempotency-Key` con un valor único de 16 a 128 caracteres, normalmente generado por el cliente.

Las operaciones privadas del cliente usan una cookie HttpOnly + SameSite=Strict emitida por el API. El token incluido en el QR queda limitado al flujo de entrega y no autoriza consulta, pago, cancelación ni comprobantes.

## Tests y CI

### Unitarios e integración

```powershell
pnpm test
```

### Smoke E2E de frontend

Usan Playwright con API simulada para validación rápida de UI:

```powershell
pnpm --filter @burger/web test:e2e
```

### E2E integrado real

La suite integrada levanta:

- PostgreSQL de test;
- Mailpit real para SMTP;
- NestJS real;
- Next.js real;
- Chromium real;
- seed determinista.

Valida, entre otros casos:

- `cliente -> pedido -> pago MOCK -> cocina -> READY -> QR -> entrega -> DELIVERED`;
- inventario y devolución exacta al cancelar/reembolsar;
- entrega grupal con varios pedidos hasta `5 de 5`;
- comprobante PDF real;
- correo de confirmación + PDF mediante Mailpit;
- separación estricta `ADMIN / KITCHEN / DELIVERY`.

El seed integrado se niega a ejecutarse si:

- `NODE_ENV` no es `test`;
- el nombre de la base no contiene `test`.

Guía:

`apps/web/e2e/README.md`

### GitHub Actions

`.github/workflows/ci.yml` ejecuta en PR/push a `main`:

1. instalación con lockfile;
2. Prisma generate;
3. migraciones;
4. typecheck;
5. tests;
6. build;
7. seed E2E;
8. instalación de Chromium;
9. E2E integrado.

`.github/workflows/security.yml` ejecuta:

- `pnpm audit`;
- Gitleaks;
- Semgrep;
- Trivy sobre las imágenes de API, Web y Backup, bloqueando HIGH/CRITICAL corregibles;
- CycloneDX SBOM en `main`.

## Observabilidad

El repositorio incluye una pila preparada para producción con:

- Grafana;
- Prometheus;
- Loki;
- Grafana Alloy;
- Tempo;
- tracing OTLP/OpenTelemetry-compatible;
- Node Exporter.

El API expone métricas internas en `/api/v1/metrics`, pero Nginx bloquea ese endpoint desde Internet. Prometheus lo consulta directamente por la red privada de Docker.

Grafana queda en:

```text
127.0.0.1:3001
```

y se recomienda acceder mediante túnel SSH.

Guías:

```text
deploy/observability/README.md
deploy/TELEGRAM.md
```

## Retención de datos

El repositorio incluye cleanup seguro de datos:

```powershell
pnpm retention:dry-run
```

Para aplicar cambios se requiere habilitación explícita:

```powershell
$env:RETENTION_CLEANUP_ENABLED="true"
pnpm retention:apply
```

En producción existe un servicio Docker y timer systemd diario preparado. El piso fiscal federal ya fue revisado y el núcleo financiero de pagos completados está protegido; el timer destructivo no debe habilitarse hasta confirmar con contador el régimen/CFDI real y revisar primero un dry-run.

Consulta `docs/RETENTION_POLICY.md`.

## Producción y recuperación

El repositorio incluye:

- Dockerfiles multi-stage;
- procesos Node non-root;
- PostgreSQL/Redis sin puertos públicos en Compose de producción;
- Nginx de referencia;
- HTTPS enforcement;
- health/readiness;
- backup PostgreSQL cifrado con `age`;
- checksum SHA-256;
- copia offsite S3-compatible preparada;
- Versioning/Object Lock checks;
- restore drill aislado;
- timers systemd;
- preflight y go-live gate.

Objetivos técnicos iniciales:

- RPO <= 1 hora;
- RTO <= 4 horas.

El RTO todavía debe medirse mediante un simulacro de pérdida total del VPS.

Documentación:

- `deploy/PRODUCTION.md`
- `deploy/REAL_INFRA_VALIDATION.md`
- `deploy/SECRETS.md`
- `docs/DATABASE_MIGRATIONS.md`
- `deploy/DR.md`
- `deploy/OFFSITE_BACKUP.md`
- `deploy/GO_LIVE_CHECKLIST.md`
- `deploy/DAST.md`

## Pendientes prioritarios

El **código funcional del MVP ya está completo**. Lo que falta antes de lanzar es principalmente producción:

1. contratar/configurar VPS y usuario deploy no-root;
2. dominio, DNS y TLS reales;
3. credenciales Mercado Pago + webhook + pruebas sandbox/reales;
4. SMTP real para confirmaciones de compra;
5. bucket offsite real y prueba de restore descargado;
6. levantar Grafana/Prometheus/Loki/Alloy y alertas en el VPS;
7. ejecutar preflight + go-live check;
8. benchmark Argon2id en el hardware objetivo;
9. confirmar con contador régimen fiscal, calendario de declaraciones y CFDI antes de habilitar cleanup destructivo;
10. simulacro de pérdida total del VPS y medición real de RPO/RTO.

El workflow DAST con OWASP ZAP ya está preparado, pero requiere staging HTTPS real para ejecutarse. OpenTelemetry/Tempo también quedó preparado y solo requiere validación operativa en el VPS. WAF/CDN, pentest externo, load testing avanzado, artifact signing o Kubernetes siguen como **madurez posterior**, no como bloqueo del MVP actual.

Consulta `docs/MVP_FINAL_STATUS.md` y `deploy/GO_LIVE_CHECKLIST.md`.

## Solución de problemas en Windows

### Corepack / pnpm

Si Corepack no reconoce las firmas de pnpm:

```powershell
npm install -g corepack@latest
corepack enable pnpm
pnpm --version
```

### Docker Desktop

Si aparece `dockerDesktopLinuxEngine pipe not found`:

```powershell
docker version
wsl --version
wsl -l -v
wsl --update
```

Después reinicia Docker Desktop y vuelve a ejecutar:

```powershell
docker compose up -d
```


## Benchmark Argon2id

Los parámetros de hashing de personal están centralizados en `apps/api/src/auth/password-security.ts`.

Para medirlos en una máquina concreta:

```powershell
pnpm security:benchmark-argon2
```

El comando ejecuta warmups y varias muestras de hash/verify y devuelve un reporte JSON con:

- algoritmo y parámetros;
- modelo de CPU;
- número de CPUs lógicas;
- mínimo;
- promedio;
- p50;
- p95;
- máximo.

Puedes cambiar el número de muestras:

```powershell
$env:ARGON2_BENCHMARK_RUNS="20"
$env:ARGON2_BENCHMARK_WARMUPS="3"
pnpm security:benchmark-argon2
```

El resultado del portátil o de GitHub Actions sirve como referencia, pero el benchmark que cierra el control de producción debe ejecutarse en el VPS/hardware objetivo.
