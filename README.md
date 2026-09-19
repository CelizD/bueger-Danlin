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
