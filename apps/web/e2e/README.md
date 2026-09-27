# Frontend E2E

Burger Danlin mantiene dos niveles de pruebas Playwright.

## Smoke E2E con API simulada

La suite original valida el navegador de forma rápida y determinista sin depender de PostgreSQL/API.

Cobertura:

- menú -> datos -> pedido -> pago mock -> QR;
- sessionStorage del capability token;
- navegación por teclado;
- login de personal;
- transición a MFA;
- credenciales inválidas;
- axe WCAG A/AA para impactos serious/critical.

Ejecutar:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @burger/web test:e2e
```

## Integrated E2E con sistema real

La suite `e2e/integration` no intercepta la API. Levanta:

- PostgreSQL de test;
- NestJS real;
- Next.js real;
- catálogo e inventario reales;
- usuarios KITCHEN y DELIVERY reales;
- Playwright/Chromium.

El flujo principal verifica:

1. cliente crea un pedido real;
2. PostgreSQL reserva inventario/capacidad;
3. pago `MOCK` real cambia el pedido a `PAID`;
4. Cocina inicia preparación;
5. Cocina marca el pedido `READY`;
6. se construye el mismo payload que contiene el QR del cliente;
7. Entrega envía el payload al endpoint real `/staff/delivery/scan`;
8. el API valida token/hash y cambia el pedido a `DELIVERED`;
9. el estado final se vuelve a consultar desde el API real.

GitHub Actions ejecuta esta suite en cada PR/push a `main`.

### Seguridad del seed

`database/prisma/e2e-seed.ts` se niega a ejecutarse si:

- `NODE_ENV` no es `test`;
- el nombre de la base de datos no contiene `test`.

Esto evita limpiar accidentalmente una base de desarrollo o producción.

### Ejecutar localmente

Usa una base separada de pruebas. No apuntes este comando a tu base normal.

Ejemplo PowerShell:

```powershell
$env:NODE_ENV="test"
$env:DATABASE_URL="postgresql://burger:burger_local@localhost:5432/burger_danlin_test?schema=public"
$env:QR_TOKEN_SECRET="local-e2e-qr-secret-not-for-production-123456789"
$env:AUTH_JWT_SECRET="local-e2e-auth-secret-not-for-production-123456789"
$env:PAYMENT_PROVIDER="mock"
$env:ENABLE_REAL_PAYMENTS="false"
$env:E2E_KITCHEN_PASSWORD="local-kitchen-e2e-passphrase-2026"
$env:E2E_DELIVERY_PASSWORD="local-delivery-e2e-passphrase-2026"

pnpm db:migrate:deploy
pnpm db:seed
pnpm db:seed:e2e
pnpm --filter @burger/web exec playwright install chromium
pnpm --filter @burger/web test:e2e:integration
```

El HTML report de Playwright queda fuera de Git.
