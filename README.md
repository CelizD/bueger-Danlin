# Burger Danlin

Plataforma de pedidos para venta de hamburguesas por preventa y entrega programada.

## Estado actual

El MVP ya permite probar en local:

1. cargar catálogo;
2. consultar el evento del sábado;
3. personalizar varios combos por pedido;
4. agregar extras y Coca-Cola;
5. capturar nombre, teléfono y correo opcional;
6. crear un pedido con precio recalculado por el backend;
7. reservar capacidad durante 15 minutos;
8. impedir vender más de 50 combos;
9. simular el pago local;
10. pasar el pedido de `PENDING_PAYMENT` a `PAID`.

## Producto inicial

- Combo hamburguesa + papas: **$130 MXN**
- Carne extra: **+$30**
- Queso extra: **+$10**
- Tocino extra: **+$15**
- Papas extra: **+$25**
- Coca-Cola en lata: **$30 MXN**

## Reglas

- Máximo **50 combos** por sábado.
- Cierre: **viernes 9:00 p. m.**
- Zona horaria: **America/Tijuana**.
- Punto inicial: **Universidad**.
- Pago obligatorio.
- Nombre y teléfono obligatorios.
- Correo opcional.
- Cancelación automática permitida hasta el cierre.
- Cada combo se personaliza de forma independiente.
- El backend es la autoridad del precio.
- Una reserva pendiente ocupa capacidad por 15 minutos.
- Una reserva expirada libera automáticamente su capacidad.

## Arquitectura

- `apps/web`: Next.js + TypeScript
- `apps/api`: NestJS + TypeScript
- `packages/types`: tipos compartidos
- `database/prisma`: PostgreSQL + Prisma 7
- `docker-compose.yml`: PostgreSQL, Redis y Mailpit
- pagos previstos para producción: Stripe + Mercado Pago

Redis queda preparado pero no es fuente de verdad ni participa todavía en el flujo crítico.

## Desarrollo local

Requisitos:

- Node.js 22+
- pnpm
- Docker Desktop

### 1. Variables

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

### 2. Infraestructura

```bash
docker compose up -d
```

### 3. Dependencias

```bash
pnpm install
```

### 4. Base de datos

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Cuando Prisma pida el nombre de la primera migración puedes usar:

```text
init
```

### 5. Aplicación

```bash
pnpm dev
```

## URLs locales

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1
- Health: http://localhost:4000/api/v1/health
- Catálogo: http://localhost:4000/api/v1/catalog
- Evento actual: http://localhost:4000/api/v1/pickup-events/current
- Mailpit: http://localhost:8025

## Endpoints implementados

### Crear pedido

`POST /api/v1/orders`

Requiere:

```text
Idempotency-Key: UUID-o-clave-de-16-a-128-caracteres
```

El servidor:

- consulta precios desde PostgreSQL;
- valida que modificadores pertenezcan al producto;
- bloquea el evento mientras valida capacidad;
- impide exceder 50 combos;
- genera código de pedido;
- reserva capacidad por 15 minutos.

### Pago local

`POST /api/v1/payments/mock/:orderCode/confirm`

Requiere:

```text
X-Order-Token: token-devuelto-al-crear-el-pedido
```

Este endpoint funciona únicamente fuera de producción y permite probar el flujo sin cobrar dinero real.

## Siguiente bloque

- QR visual y comprobante del pedido.
- Vista Cocina.
- Vista Entregas.
- Panel administrador.
- Autenticación y roles.
- Cancelaciones/reembolsos.
- Stripe.
- Mercado Pago.


## Solución de problemas en Windows

### Corepack: Cannot find matching keyid

Node.js 22.13.1 puede incluir una versión antigua de Corepack que no reconoce las firmas actuales de pnpm.

```powershell
npm install -g corepack@latest
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm --version
```

Después:

```powershell
pnpm install
```

### Docker: dockerDesktopLinuxEngine pipe not found

Abre Docker Desktop y espera a que el motor esté ejecutándose. Verifica:

```powershell
docker version
```

Debe aparecer tanto Client como Server. Si el Server no aparece, verifica WSL:

```powershell
wsl --version
wsl -l -v
wsl --update
```

Luego reinicia Docker Desktop y vuelve a ejecutar:

```powershell
docker compose up -d
```


## Panel administrativo

Rutas:

- Login: http://localhost:3000/admin/login
- Pedidos: http://localhost:3000/admin/pedidos

El acceso de personal usa:

- contraseñas almacenadas con Argon2id;
- parámetros Argon2id: 19 MiB de memoria, 2 iteraciones y paralelismo 1;
- JWT de sesión de 8 horas;
- JWT almacenado en cookie HttpOnly;
- cookie SameSite=Lax;
- cookie Secure en producción;
- verificación en servidor de que el usuario sigue activo;
- autorización por rol ADMIN para consultar pedidos.

### Crear el administrador local

No se guardan contraseñas en Git.

Agrega en tu archivo `.env`:

```text
AUTH_JWT_SECRET=<secreto-aleatorio-de-al-menos-32-caracteres>
ADMIN_SEED_EMAIL=<tu-correo-admin>
ADMIN_SEED_PASSWORD=<tu-contraseña-de-al-menos-12-caracteres>
ADMIN_SEED_NAME=<tu-nombre>
```

Después vuelve a ejecutar:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" db:seed
```

El seed crea o actualiza la cuenta ADMIN y almacena únicamente el hash Argon2id de la contraseña.


## Entrega por QR

Flujo local:

1. El cliente crea y paga el pedido.
2. Después del pago aparece un QR de retiro sin datos personales.
3. Cocina mueve el pedido de `PAID` a `PREPARING` y luego a `READY`.
4. En `/admin/entrega`, personal autorizado abre la cámara y escanea el QR.
5. El API valida el token contra el hash almacenado y, solo si el pedido está pagado y `READY`, lo mueve a `DELIVERED`.
6. Un segundo escaneo del mismo QR no genera una segunda entrega.

El escáner usa la cámara del navegador. En desarrollo funciona en `localhost`; para usar la cámara desde otro dispositivo por red local se recomienda servir la aplicación mediante HTTPS, ya que `getUserMedia()` requiere un contexto seguro.


## Administración de sábados

El calendario de entregas ya no se administra desde `seed.ts`.

Panel:

- `/admin/sabados`

Desde esa pantalla un usuario `ADMIN` puede:

- crear una nueva entrega de sábado como borrador;
- cambiar lugar, fecha, hora de entrega y hora límite;
- cambiar el límite de combos;
- abrir o cerrar pedidos;
- ver combos pagados, reservas pendientes y cupo restante;
- reabrir una fecha cerrada mientras su cierre y entrega sigan en el futuro.

Reglas:

- solo puede existir una fecha `OPEN` / `SOLD_OUT` activa para clientes;
- al abrir otra fecha, la anterior se cierra;
- no se permite bajar el límite por debajo de los combos ya reservados/pagados;
- las fechas se interpretan en `America/Tijuana`;
- la fecha de entrega debe ser sábado;
- al vencer la hora límite, el evento se normaliza a `CLOSED`;
- si expiran reservas pendientes y vuelve a haber cupo, `SOLD_OUT` vuelve a `OPEN`;
- el cliente obtiene fecha, hora, lugar y disponibilidad directamente del evento activo.

El seed sigue sirviendo para catálogo y creación/actualización del administrador local, pero no crea ni modifica `PickupEvent`.


## Cancelaciones de clientes

El cliente puede administrar su pedido desde el enlace seguro generado después de crear la orden:

- `/pedido/:orderCode#token=...`

El token viaja en el fragmento de URL, no en la query string, y se guarda localmente en el navegador después de abrir el enlace. El API siempre vuelve a validar el token contra el hash guardado en la orden.

Reglas:

- la cancelación solo se permite antes de `PickupEvent.closesAt` (normalmente viernes 9:00 p. m.);
- cancelar una orden pendiente libera inmediatamente su reserva de capacidad;
- cancelar una orden pagada también libera el cupo;
- con `MOCK`, el reembolso se completa inmediatamente y la orden termina en `REFUNDED`;
- para Stripe/Mercado Pago, mientras no estén integrados, se persiste una solicitud de reembolso en los metadatos del pago y la orden queda `CANCELLED` con reembolso pendiente;
- repetir la misma cancelación es idempotente y no crea un segundo reembolso;
- si un evento estaba `SOLD_OUT` y una cancelación libera espacio antes del cierre, vuelve a `OPEN`;
- cada cancelación/reembolso crea registros en `OrderStatusHistory` y `AuditLog`.

El panel `/admin/pedidos` incluye filtros de cancelados/reembolsados y muestra el historial de estados de cada pedido.


## Usuarios del personal

Panel:

- `/admin/personal`

Solo un usuario con rol `ADMIN` puede administrar cuentas del personal.

Funciones:

- crear cuentas `ADMIN`, `KITCHEN` y `DELIVERY`;
- activar o desactivar cuentas;
- cambiar el rol de una cuenta;
- cambiar contraseñas;
- buscar y filtrar personal;
- ver una matriz de permisos por rol.

Reglas de seguridad:

- contraseñas con Argon2id;
- mínimo 12 caracteres para nuevas contraseñas;
- cada cambio queda registrado en `AuditLog`;
- un administrador no puede desactivar su propia cuenta;
- un administrador no puede quitarse a sí mismo el rol `ADMIN`;
- al desactivar una cuenta, su sesión deja de ser válida en la siguiente petición;
- un cambio de rol entra en vigor inmediatamente porque el guard consulta el usuario actual en PostgreSQL;
- un cambio de contraseña invalida los JWT anteriores de esa cuenta mediante una versión derivada de la credencial.

Permisos actuales:

- `ADMIN`: Dashboard, Pedidos, Cocina, Entrega, Sábados, Inventario y Personal.
- `KITCHEN`: solo Cocina; puede mover pedidos pagados a `PREPARING` y `READY`.
- `DELIVERY`: solo Entrega; puede validar QR y mover `READY` a `DELIVERED`.

Los permisos no dependen del frontend: también están validados por guards en el API.


## Dashboard de ventas

Panel:

- `/admin/dashboard`

Solo `ADMIN` puede acceder.

Métricas:

- ingresos de pedidos pagados no cancelados/reembolsados;
- combos vendidos;
- Coca-Colas vendidas;
- ticket promedio;
- pedidos cancelados;
- pedidos reembolsados;
- pedidos `NO_SHOW`;
- ranking de extras vendidos;
- ventas agrupadas por sábado.

El dashboard puede filtrarse por un `PickupEvent` específico o mostrar el acumulado de todos los sábados.

Los pedidos `NO_SHOW` siguen contando como venta cuando están pagados y no tienen reembolso, de acuerdo con la regla operativa de no reembolso automático.


## Inventario

Panel:

- `/admin/inventario`

Artículos controlados inicialmente:

- Coca-Cola por lata;
- Carne por porción;
- Queso por porción;
- Tocino por porción;
- Papas por porción.

Reglas de consumo:

- cada combo reserva 1 porción de carne y 1 porción de papas;
- queso y tocino incluidos solo consumen stock si el cliente no los quita;
- carne extra, queso extra, tocino extra y papas extra consumen 1 porción adicional;
- cada Coca-Cola consume 1 lata.

Flujo de inventario:

1. Al crear un pedido, el API bloquea las filas de inventario necesarias.
2. Si existe stock, lo descuenta y crea una reserva por 15 minutos.
3. Al pagar, la reserva pasa a `COMMITTED`.
4. Si el cliente cancela, el stock regresa automáticamente.
5. Si una reserva pendiente vence, se libera automáticamente la siguiente vez que se consulta o reserva inventario.
6. Si no existe stock suficiente, el pedido completo se revierte y no se vende.

El panel permite cambiar el stock disponible, el umbral de stock bajo y activar/desactivar el control de cada artículo. Los cambios manuales quedan registrados en `AuditLog`.

La página del cliente consulta `/inventory/availability` para limitar combos, Coca-Colas y extras antes del checkout. El backend vuelve a validar dentro de la transacción, por lo que la protección no depende del frontend.

Después de aplicar la migración por primera vez, ejecuta el seed para crear las cinco definiciones y sus reglas de consumo. El seed crea el stock inicial en 0 y en ejecuciones posteriores no sobrescribe las cantidades que hayas configurado desde el panel.


### CRUD de inventario

El panel `/admin/inventario` permite:

- crear artículos;
- editar nombre y unidad;
- cambiar stock disponible;
- cambiar umbral de stock bajo;
- activar/desactivar control;
- eliminar artículos cuando no estén vinculados a ventas ni tengan historial.

Los artículos base de Burger Danlin están vinculados a reglas de consumo, por lo que no se eliminan físicamente; se desactivan si dejan de usarse. Los artículos nuevos creados manualmente comienzan como inventario general y pueden eliminarse mientras no tengan movimientos o reglas asociadas.

Endpoints administrativos:

- `GET /admin/inventory`
- `POST /admin/inventory`
- `PATCH /admin/inventory/:id`
- `DELETE /admin/inventory/:id`

Todos requieren rol `ADMIN` y los cambios se registran en `AuditLog`.


## Seguridad de producción

El API incluye las siguientes protecciones:

- rate limiting global y límite reforzado para `POST /auth/login`;
- bloqueo persistente de cuentas después de 5 intentos fallidos durante 15 minutos;
- contraseña verificada con Argon2id y comparación contra hash dummy para reducir enumeración/timing;
- cookies de sesión `HttpOnly`, `Secure` y `SameSite=Strict` en producción;
- invalidación de sesiones antiguas después de cambiar contraseña;
- protección CSRF para mutaciones del panel mediante origen permitido y Fetch Metadata;
- CORS restringido a `APP_ORIGIN`;
- Helmet en el API;
- headers de seguridad en Next.js y `X-Powered-By` deshabilitado;
- HSTS en producción;
- `FORCE_HTTPS` para rechazar/redirigir tráfico inseguro cuando el API está detrás del reverse proxy;
- validación de secretos al arrancar en `NODE_ENV=production`;
- logs HTTP estructurados con `X-Request-Id`, método, ruta, estado y duración, sin registrar bodies ni secretos;
- soporte de raw body para validación de firmas de webhook;
- verificadores HMAC con comparación en tiempo constante y ventana anti-replay para Stripe y Mercado Pago.

### Variables de producción

Como mínimo:

```text
NODE_ENV=production
APP_ORIGIN=https://app.tudominio.com
FORCE_HTTPS=true

DATABASE_URL=postgresql://...
AUTH_JWT_SECRET=<secreto aleatorio de 48+ caracteres>
QR_TOKEN_SECRET=<otro secreto aleatorio de 48+ caracteres>

PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

`AUTH_JWT_SECRET` y `QR_TOKEN_SECRET` deben ser diferentes. El arranque de producción falla si encuentra valores débiles o placeholders conocidos.

Puedes generar secretos aleatorios desde Node:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Ejecuta el comando dos veces y usa valores diferentes.

### Rate limiting y bloqueo de login

- API general: 120 solicitudes por minuto por IP/proceso.
- Login: máximo 5 solicitudes por minuto por IP.
- Cuenta: después de 5 credenciales incorrectas se guarda `lockedUntil` en PostgreSQL y se bloquea durante 15 minutos.
- Un login correcto reinicia el contador y registra `lastLoginAt`.

El bloqueo de cuenta es persistente y funciona aunque reinicies el API. El rate limiting de IP usa almacenamiento en memoria; si en el futuro ejecutas varias réplicas del API, conviene mover el almacenamiento del throttler a Redis.

### CSRF

Las mutaciones autenticadas del panel y login/logout validan el header `Origin` contra `APP_ORIGIN` y rechazan solicitudes con `Sec-Fetch-Site: cross-site`. Esto se combina con cookies `SameSite=Strict` en producción.

Pedidos públicos, consultas públicas y futuros webhooks de proveedores no dependen de la cookie de personal y no usan esta validación CSRF.

### HTTPS

Nest confía en un único reverse proxy en producción y `FORCE_HTTPS=true` exige HTTPS. El proxy debe enviar `X-Forwarded-Proto: https`.

Existe un ejemplo en:

- `deploy/nginx/burger-danlin.conf.example`

Configura certificados reales (por ejemplo Let's Encrypt) antes de habilitarlo.

### Logs

Cada petición genera un `X-Request-Id` y un log con:

- request ID;
- método;
- path sin query string;
- status HTTP;
- duración;
- IP;
- User-Agent truncado.

No se registran request bodies, contraseñas, tokens, cookies ni secretos.

### Webhooks

`WebhookSecurityService` implementa validación de firma para futuros handlers reales:

- Stripe: valida `Stripe-Signature` sobre el raw body, HMAC-SHA256, timestamp y tolerancia de 5 minutos.
- Mercado Pago: valida `x-signature`, `x-request-id` y `data.id` con el manifest oficial y HMAC-SHA256.
- ambas comparaciones usan `timingSafeEqual`.

Los endpoints reales de Stripe/Mercado Pago todavía no se publican hasta implementar el flujo de pagos. Esto evita aceptar un webhook válido sin procesar correctamente el pago.


## MFA de administradores

Las cuentas con rol `ADMIN` requieren segundo factor TOTP antes de recibir una sesión administrativa.

Flujo:

1. correo + contraseña;
2. el API crea un challenge HttpOnly de 5 minutos;
3. si es el primer acceso, se muestra un QR `otpauth://`;
4. el administrador confirma un código TOTP de 6 dígitos;
5. el API habilita MFA y entrega 8 códigos de recuperación de un solo uso;
6. solo después de MFA se emite la cookie de sesión administrativa.

Seguridad:

- secreto TOTP aleatorio de 160 bits;
- secreto almacenado cifrado con AES-256-GCM;
- `MFA_ENCRYPTION_KEY` separada de `AUTH_JWT_SECRET`;
- códigos TOTP con periodo de 30 segundos y tolerancia ±1 ventana;
- el mismo timestep TOTP no puede reutilizarse;
- códigos de recuperación guardados únicamente como SHA-256;
- challenge MFA firmado, HttpOnly y con expiración de 5 minutos;
- respuestas de enrollment MFA llevan `Cache-Control: no-store`;
- el guard rechaza cualquier sesión `ADMIN` si MFA no está habilitado;
- otro administrador puede restablecer el MFA desde `/admin/personal`;
- un administrador no puede restablecer su propio MFA desde una sesión activa.

Para desarrollo genera una clave MFA:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

y colócala en:

```text
MFA_ENCRYPTION_KEY=<resultado>
```

En producción esta variable es obligatoria y debe mantenerse en el gestor de secretos de la infraestructura.


## Health/readiness

Endpoints operativos del API:

- `GET /api/v1/health`: compatibilidad; responde el mismo liveness check.
- `GET /api/v1/health/live`: confirma que el proceso Nest está vivo.
- `GET /api/v1/health/ready`: comprueba PostgreSQL mediante `SELECT 1`.

`/health/ready` devuelve HTTP `503` cuando PostgreSQL no está disponible, para que un reverse proxy, monitor o futuro orquestador pueda retirar la instancia del tráfico sin confundir “proceso vivo” con “aplicación lista”.

Los health checks llevan `Cache-Control: no-store` y no consumen la cuota global de rate limiting.


## Formato de errores del API

Las excepciones HTTP pasan por un filtro global. La respuesta pública usa un formato consistente:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Mensaje seguro para el cliente",
    "requestId": "..."
  }
}
```

Los errores `5xx` nunca exponen el mensaje técnico de la excepción, stack trace, SQL ni rutas internas. El detalle mínimo de diagnóstico se envía al log del servidor asociado al mismo `requestId`.
