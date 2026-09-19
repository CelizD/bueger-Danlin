# Arquitectura

```text
Cliente
  |
  v
Next.js
  |
  v
NestJS REST /api/v1
  |--------------------|
  v                    v
PostgreSQL           Redis
```

## Principios
1. El backend calcula todos los precios.
2. PostgreSQL es la fuente de verdad.
3. El límite de 50 combos se protege con transacciones.
4. Un pago solo se confirma con el proveedor, no por redirección del navegador.
5. Los QR no contienen datos personales.
6. Zona horaria de negocio: America/Tijuana.
7. Pagos desacoplados: Mock, Stripe y Mercado Pago.
8. Redis no es fuente de verdad y solo se usa cuando aporta valor.

## Módulos previstos
auth, users, customers, catalog, pickup-events, orders, payments, kitchen, delivery, audit.
