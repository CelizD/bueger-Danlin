# Burger Danlin

Plataforma web de preventa de hamburguesas con pedidos programados para sábado, control de capacidad, inventario, cocina, entrega por QR y panel administrativo.

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
- consulta segura del pedido mediante `X-Order-Token`;
- cancelación y reembolso local simulado.

### Cocina

Ruta:

`/admin/cocina`

Roles permitidos:

- `ADMIN`
- `KITCHEN`

Flujo:

`PAID/CONFIRMED -> PREPARING -> READY`

### Entrega

Ruta:

`/admin/entrega`

Roles permitidos:

- `ADMIN`
- `DELIVERY`

El QR usa el formato:

`BD1:<orderCode>:<verificationToken>`

El API valida el token contra el hash almacenado. Un QR reutilizado no genera una segunda entrega.

### Administración

Rutas principales:

- `/admin/dashboard`
- `/admin/pedidos`
- `/admin/sabados`
- `/admin/inventario`
- `/admin/personal`
- `/admin/cocina`
- `/admin/entrega`

Incluye:

- dashboard de ventas;
- administración de sábados;
- inventario;
- cuentas de personal;
- roles `ADMIN`, `KITCHEN` y `DELIVERY`;
- historial de estados;
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

## Pagos

Los pagos reales están **intencionalmente deshabilitados** mientras el resto del producto termina de validarse.

Desarrollo:

```text
PAYMENT_PROVIDER=mock
ENABLE_REAL_PAYMENTS=false
```

Existe arquitectura desacoplada mediante `PaymentProvider` y `PaymentProviderRegistry`.

Actualmente:

- `MockPaymentProvider`: activo para desarrollo/tests;
- Mercado Pago: cliente Orders API y creación de checkout preparados;
- Stripe: reservado en la arquitectura;
- `ENABLE_REAL_PAYMENTS=false`: kill switch global;
- el backend bloquea tráfico real antes de persistir checkout y antes de cualquier `fetch` al proveedor.

Todavía pendientes antes de pagos reales:

- webhook real;
- deduplicación persistente de eventos;
- `getPayment()`;
- reembolsos reales;
- reconciliación;
- sandbox end-to-end;
- pruebas de fallo/reintentos;
- activación explícita de `ENABLE_REAL_PAYMENTS=true`.

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

Las operaciones privadas del cliente requieren el header `X-Order-Token` con el token opaco devuelto al crear el pedido.

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
- NestJS real;
- Next.js real;
- Chromium real;
- seed determinista.

Valida:

`cliente -> pedido -> pago MOCK -> cocina -> READY -> QR -> entrega -> DELIVERED`

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
- CycloneDX SBOM en `main`.

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
- `deploy/DR.md`
- `deploy/OFFSITE_BACKUP.md`
- `deploy/GO_LIVE_CHECKLIST.md`

## Pendientes prioritarios

Los siguientes bloques todavía sí están pendientes:

1. ejecutar el benchmark Argon2id en el hardware objetivo y registrar el resultado;
2. image scanning de contenedores;
3. threat model + inventario de datos + política de retención;
4. métricas, tracing, alertas y logs centralizados;
5. runbooks de incidentes;
6. ADRs;
7. load/stress testing;
8. staging y rollback probado;
9. DAST;
10. infraestructura real: dominio, TLS, WAF/CDN y backup offsite real;
11. simulacro completo de pérdida del VPS;
12. pentest prelaunch;
13. integración completa de pagos reales.

No se planean microservicios ni Kubernetes para el MVP salvo que una necesidad técnica real lo justifique.

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
