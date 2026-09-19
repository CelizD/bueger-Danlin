# Burger Danlin

Plataforma de pedidos para venta de hamburguesas por preventa y entrega programada.

## MVP

- Combo hamburguesa + papas: $130 MXN
- Extras: carne +$30, queso +$10, tocino +$15, papas +$25
- Coca-Cola en lata: $30 MXN
- Máximo 50 combos por sábado
- Cierre de pedidos: viernes 9:00 p. m. (America/Tijuana)
- Punto de entrega inicial: Universidad
- Pago obligatorio
- Integraciones de producción previstas: Stripe y Mercado Pago
- Nombre y teléfono obligatorios; correo opcional
- Cancelaciones automáticas permitidas hasta el cierre

## Arquitectura

Monorepo con:

- `apps/web`: Next.js + TypeScript
- `apps/api`: NestJS + TypeScript
- `database/prisma`: PostgreSQL + Prisma
- `infrastructure`: Docker Compose para desarrollo local
- `docs`: documentación técnica y funcional

El desarrollo inicia 100% en local. La infraestructura de producción se definirá posteriormente.
