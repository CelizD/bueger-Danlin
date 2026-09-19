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
