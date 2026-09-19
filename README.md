# Burger Danlin

Plataforma de pedidos para venta de hamburguesas por preventa y entrega programada.

## MVP
- Combo hamburguesa + papas: **$130 MXN**
- Extras: carne **+$30**, queso **+$10**, tocino **+$15**, papas **+$25**
- Coca-Cola en lata: **$30 MXN**
- Máximo **50 combos** por sábado
- Cierre: **viernes 9:00 p. m.**
- Zona horaria: **America/Tijuana**
- Punto de entrega inicial: **Universidad**
- Pago obligatorio
- Producción prevista: Stripe + Mercado Pago
- Nombre y teléfono obligatorios; correo opcional

## Arquitectura
- `apps/web`: Next.js + TypeScript
- `apps/api`: NestJS + TypeScript
- `packages/types`: tipos compartidos
- `database/prisma`: PostgreSQL + Prisma
- `docker-compose.yml`: PostgreSQL, Redis y Mailpit

## Local
```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Web: http://localhost:3000  
API: http://localhost:4000/api/v1  
Mailpit: http://localhost:8025
