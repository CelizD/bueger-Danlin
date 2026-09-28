# Matriz obligatoria de AuditLog

Esta matriz define las mutaciones y eventos de seguridad que Burger Danlin debe registrar en `AuditLog`.

## Reglas

- No registrar contraseñas, hashes de contraseña, secretos MFA, JWT, cookies, tokens de pedido, QR, `verificationToken` ni credenciales de proveedor.
- No registrar nombre, teléfono o correo de clientes en `before` / `after` salvo que exista una necesidad operativa explícita y revisada.
- `userId` identifica al actor autenticado cuando existe.
- Eventos iniciados por cliente o sistema pueden usar `userId = null`.
- `entityType` y `entityId` deben permitir localizar la entidad afectada.
- `before` y `after` deben contener solo los campos necesarios para explicar el cambio.
- AuditLog no se expone mediante endpoints de escritura. Su purga se realiza únicamente por la política de retención.

## Autenticación y sesiones

| Acción | Entidad | Actor | Evidencia mínima |
|---|---|---|---|
| `STAFF_LOGIN_FAILED` | User | usuario conocido | intento fallido |
| `STAFF_LOGIN_LOCKED` | User | usuario conocido | lockedUntil |
| `STAFF_LOGIN_MFA_REQUIRED` | User | usuario | setupRequired |
| `STAFF_MFA_ENROLLED` | User | usuario | MFA habilitado |
| `STAFF_MFA_VERIFIED` | User | usuario | MFA verificado |
| `STAFF_MFA_RECOVERY_USED` | User | usuario | recovery usado |
| `STAFF_LOGIN_SUCCESS` | User/StaffSession | usuario | rol + sessionId cuando aplique |
| `STAFF_LOGOUT` | StaffSession | usuario | sesión revocada |

## Administración de personal

| Acción | Entidad | Actor |
|---|---|---|
| `STAFF_USER_CREATED` | User | ADMIN |
| `STAFF_USER_UPDATED` | User | ADMIN |
| `STAFF_PASSWORD_RESET` | User | ADMIN |
| `STAFF_MFA_RESET` | User | ADMIN |

## Inventario

| Acción | Entidad | Actor |
|---|---|---|
| `INVENTORY_ITEM_CREATED` | InventoryItem | ADMIN |
| `INVENTORY_ITEM_UPDATED` | InventoryItem | ADMIN |
| `INVENTORY_ITEM_DELETED` | InventoryItem | ADMIN |

Los movimientos automáticos de reserva/commit/release se reconstruyen desde `InventoryAllocation` y el historial del pedido; no generan un AuditLog independiente por cada unidad.

## Puntos de entrega y grupos

| Acción | Entidad | Actor |
|---|---|---|
| `PICKUP_EVENT_CREATED` | PickupEvent | ADMIN |
| `PICKUP_EVENT_UPDATED` | PickupEvent | ADMIN |
| `PICKUP_EVENT_OPENED` | PickupEvent | ADMIN |
| `GROUP_DELIVERY_FINALIZED` | PickupEvent | ADMIN o sistema |
| `ORDER_CANCELLED_AT_PICKUP_CUTOFF` | Order | sistema |

El cierre manual y automático comparten `GROUP_DELIVERY_FINALIZED`.

## Pedidos

| Acción | Entidad | Actor |
|---|---|---|
| `ORDER_CREATED` | Order | cliente |
| `ORDER_STATUS_CHANGED` | Order | KITCHEN/DELIVERY/ADMIN autorizado |
| `ORDER_QR_DELIVERED` | Order | DELIVERY/ADMIN autorizado |
| `CUSTOMER_ORDER_CANCELLED` | Order | cliente |
| `CUSTOMER_ORDER_REFUNDED` | Order | cliente / flujo de reembolso |
| `CUSTOMER_REFUND_REQUESTED` | Order | cliente |

`ORDER_CREATED` no guarda PII del cliente ni el token de verificación.

## Pagos

| Acción | Entidad | Actor |
|---|---|---|
| `PAYMENT_CHECKOUT_CREATED` | Payment | cliente |
| `PAYMENT_CONFIRMED` | Payment | proveedor/mock verificado |
| `PAYMENT_WEBHOOK_APPLIED` | Payment | webhook Mercado Pago verificado |
| `PAYMENT_WEBHOOK_IGNORED` | Payment | webhook Mercado Pago verificado |

El payload de auditoría de pagos puede guardar IDs internos, proveedor, estado, moneda e importe, pero no credenciales, URLs firmadas, secretos ni tokens.

La deduplicación técnica del webhook se conserva además en `PaymentWebhookEvent`. Los eventos procesados/ignorados tienen retención técnica de 90 días; los fallidos se preservan para investigación y reintento.

## Verificación

`apps/api/src/audit/audit-policy.spec.ts` falla en CI si desaparece del código alguna acción obligatoria de esta matriz.

Además, las pruebas de servicios verifican los payloads críticos de:
- logout/revocación de sesión;
- creación de pedido sin PII;
- confirmación de pago;
- checkout de pago;
- entrega por QR;
- cierre de grupo.
