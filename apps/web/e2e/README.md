# Frontend E2E

Burger Danlin mantiene dos niveles de pruebas Playwright.

## Smoke E2E con API simulada

La suite original valida el navegador de forma rápida y determinista sin depender de PostgreSQL/API.

Cobertura:

- menú -> datos -> pedido -> pago mock -> QR;
- ausencia de capability del pedido en sessionStorage y uso de cookie HttpOnly;
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
- usuarios ADMIN, KITCHEN y DELIVERY reales;
- configuración MFA real para ADMIN;
- Playwright/Chromium.

La suite integrada verifica dos recorridos principales.

### Flujo cliente -> operación

1. cliente crea un pedido real;
2. PostgreSQL reserva inventario/capacidad;
3. pago `MOCK` real cambia el pedido a `PAID`;
4. Cocina inicia preparación;
5. Cocina marca el pedido `READY`;
6. el cliente obtiene el QR de entrega mediante un endpoint autenticado por cookie HttpOnly;
7. Entrega envía el payload al endpoint real `/staff/delivery/scan`;
8. el API valida token/hash y cambia el pedido a `DELIVERED`;
9. el estado final se vuelve a consultar desde el API real.

### Flujo administrativo

1. ADMIN inicia sesión con contraseña real;
2. configura MFA TOTP real y recibe recovery codes;
3. crea, actualiza y elimina un artículo de Inventario;
4. crea un punto/fecha de entrega en estado borrador y valida su QR;
5. crea una cuenta de Personal, cambia su rol y la desactiva;
6. procesa una solicitud ARCO real desde recepción hasta resolución.

### Matriz negativa de permisos

- sin sesión: endpoints privados responden `401`;
- KITCHEN: Cocina responde `200`, Entrega y Admin responden `403`;
- DELIVERY: Entrega responde `200`, Cocina y Admin responden `403`;
- se prueban tanto lecturas como operaciones POST/PATCH prohibidas;
- las páginas de otro rol redirigen al panel autorizado del usuario.

### Accesibilidad integrada

Axe se ejecuta en CI sobre estados reales de:

- Home;
- Login y verificación MFA;
- Dashboard;
- Pedidos;
- Inventario;
- Agenda;
- Personal;
- ARCO;
- Cocina;
- Entrega.

La suite falla ante violaciones WCAG con impacto `serious` o `critical`. El usuario ADMIN de accesibilidad usa MFA real sembrado exclusivamente en la base E2E.

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
$env:E2E_ADMIN_PASSWORD="local-admin-e2e-passphrase-2026"
$env:E2E_KITCHEN_PASSWORD="local-kitchen-e2e-passphrase-2026"
$env:E2E_DELIVERY_PASSWORD="local-delivery-e2e-passphrase-2026"
$mfaBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($mfaBytes)
$env:MFA_ENCRYPTION_KEY = [Convert]::ToBase64String($mfaBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")

pnpm db:migrate:deploy
pnpm db:seed
pnpm db:seed:e2e
pnpm --filter @burger/web exec playwright install chromium
pnpm --filter @burger/web test:e2e:integration
```

El HTML report de Playwright queda fuera de Git.
