# Inventario de Datos — Burger Danlin

Fecha: 2026-09-27

## 1. Objetivo

Este documento identifica los datos que Burger Danlin procesa actualmente, dónde viven, para qué se usan y qué nivel de protección requieren.

No sustituye un aviso de privacidad legal.

## 2. Clasificación

- **Público**: puede mostrarse públicamente.
- **Interno**: información operativa no pública.
- **Personal**: identifica o puede relacionarse con una persona.
- **Secreto**: credenciales, tokens o claves cuya exposición permite acceso.
- **Financiero/operativo sensible**: datos de pagos o negocio que requieren protección adicional.

## 3. Datos por entidad

| Entidad / origen | Datos | Clasificación | Uso | Persistencia |
|---|---|---|---|---|
| Customer | nombre | Personal | identificar pedido | PostgreSQL |
| Customer | teléfono | Personal | contacto/identificación de pedido | PostgreSQL |
| Customer | email opcional | Personal | contacto | PostgreSQL |
| Order | orderCode | Interno | referencia de pedido | PostgreSQL |
| Order | requestKey/requestHash | Interno | idempotencia | PostgreSQL |
| Order | totales, cantidades, estado | Interno/financiero | operación y conciliación | PostgreSQL |
| Order | verificationTokenHash | Secreto derivado | validar entrega | PostgreSQL |
| Order | fechas de reserva/cancelación/entrega | Interno | operación | PostgreSQL |
| OrderItem | productos, extras, cantidades, precios | Interno | preparar pedido | PostgreSQL |
| Payment | proveedor, estado, monto, moneda | Financiero/operativo | pago y conciliación | PostgreSQL |
| Payment | externalId | Financiero/operativo | correlación con proveedor | PostgreSQL |
| Payment | idempotencyKey | Interno | evitar duplicados | PostgreSQL |
| Payment | metadata | Potencialmente sensible | integración proveedor | PostgreSQL; debe mantenerse minimizada |
| User | nombre/email/rol | Personal interno | cuenta de staff | PostgreSQL |
| User | passwordHash | Secreto derivado | autenticación | PostgreSQL |
| User | failedLoginAttempts/lockedUntil/lastLoginAt | Interno seguridad | defensa de cuenta | PostgreSQL |
| User | mfaSecretEncrypted | Secreto | MFA | PostgreSQL cifrado AES-256-GCM |
| User | recovery code hashes | Secreto derivado | recuperación MFA | PostgreSQL |
| AuditLog | userId, acción, entidad, before/after | Interno; puede contener personal | auditoría | PostgreSQL |
| HTTP logs | requestId, método, path, status, duración, IP, UA | Personal/técnico | operación y seguridad | stdout/Docker/journald |
| Frontend telemetry | ruta, Web Vitals, tipo de error, digest | Técnico | calidad/diagnóstico | logs |
| QR cliente | orderCode + verification token | Secreto temporal | entrega | presentado por cliente; token en claro no se persiste |
| JWT staff | identidad/rol/version de credencial | Secreto temporal | sesión | cookie HttpOnly del navegador |
| Variables de entorno | DB, Redis, JWT, MFA, QR, pagos | Secreto | operación | archivo/entorno del host |
| Backup DB | copia de tablas | Personal + secreto derivado + financiero | recuperación | archivo cifrado age/offsite |
| Catálogo/inventario | producto, precio, stock | Público/Interno | venta/operación | PostgreSQL |
| ArcoRequest | nombre, email, teléfono opcional, derechos solicitados, descripción y datos para localizar información | Personal | recibir y atender derechos ARCO | PostgreSQL |
| ArcoRequest | estado, verificación de identidad, notas internas y fechas de atención | Personal/Interno | seguimiento y evidencia de atención | PostgreSQL |

## 4. Datos que el sistema no debería almacenar

Salvo un cambio explícito de alcance, Burger Danlin no debe guardar:

- números completos de tarjeta;
- CVV;
- contraseñas en texto plano;
- códigos TOTP usados;
- tokens de sesión en logs;
- X-Order-Token en logs;
- verificationToken en logs;
- secretos de proveedor en base de datos;
- cuerpos completos de requests en logs;
- documentos oficiales mediante el formulario ARCO público;
- ubicación precisa del cliente;
- datos biométricos.

Los datos de tarjeta deben permanecer en el proveedor de pagos.

## 5. Flujos de datos

### Pedido

Cliente
→ Web
→ API
→ validación
→ PostgreSQL

Datos principales:
- nombre;
- teléfono;
- email opcional;
- selección de productos;
- cantidades.

### Consulta/cancelación de pedido

Cliente
→ Web
→ API con X-Order-Token
→ PostgreSQL

El token funciona como capability y debe tratarse como secreto.

### Staff

Staff
→ login
→ API
→ PostgreSQL
→ JWT/cookie

ADMIN adicionalmente:
→ challenge MFA
→ TOTP/recovery code
→ API

### Pago real futuro

API
↔ proveedor de pagos

Solo deben enviarse los datos mínimos requeridos por el proveedor.

### Solicitudes ARCO

Titular
→ formulario público `/arco`
→ API `POST /privacy/arco`
→ PostgreSQL
→ folio de recepción

El formulario no acepta carga de identificaciones oficiales. La acreditación de identidad o representación debe coordinarse posteriormente por un canal controlado antes de entregar o modificar datos.

ADMIN con MFA
→ `/admin/arco`
→ revisión y actualización de estado

No existe consulta pública por folio para evitar enumeración o exposición de solicitudes.

### Logs

API/Web
→ stdout
→ Docker/journald
→ futuro sistema centralizado

No se registran bodies, cookies ni secretos.

### Backup

PostgreSQL
→ dump temporal
→ cifrado age
→ almacenamiento local
→ futuro offsite S3-compatible

## 6. Principio de minimización

1. Email de cliente permanece opcional.
2. No almacenar tarjeta/CVV.
3. No incluir PII en QR.
4. No guardar tokens opacos en claro.
5. No incluir bodies/cookies en logs.
6. Payment.metadata debe limitarse a identificadores/estado necesarios.
7. AuditLog no debe convertirse en copia completa de objetos con PII salvo necesidad de auditoría.
8. Nuevos campos personales requieren actualizar este inventario.
9. Las solicitudes ARCO no deben copiarse completas a AuditLog ni a correos operativos.

## 7. Acceso por rol

### Cliente

Puede acceder únicamente a su pedido presentando el token correspondiente.

### DELIVERY

Debe acceder solo a lo requerido para validar entrega.

### KITCHEN

Debe acceder solo a información necesaria para preparación y estado.

### ADMIN

Acceso operativo amplio, sujeto a MFA y AuditLog.

### Runtime DB

Solo DML requerido por la aplicación; sin privilegios administrativos.

### Operador infraestructura

Puede tener acceso técnico a DB/backups y por ello debe considerarse privilegiado.

## 8. Proveedores/subprocesadores previstos

- Proveedor VPS.
- Proveedor de object storage para backups.
- Mercado Pago o Stripe cuando se active pago real.
- GitHub para repositorio/CI; no debe recibir datos de clientes de producción.

Agregar cualquier nuevo proveedor antes de enviarle datos de producción.

## 9. Reglas de logging

Permitido:
- request ID;
- ruta sin query string;
- status;
- latencia;
- IP;
- user-agent acotado;
- identificadores técnicos no secretos.

Prohibido:
- Authorization;
- cookies;
- JWT;
- X-Order-Token;
- QR token;
- contraseñas;
- TOTP;
- recovery code;
- DATABASE_URL;
- claves de API;
- cuerpos de pedidos completos.

## 10. Cambios que requieren actualizar este inventario

- cuentas para clientes;
- domicilio/envío;
- facturación;
- archivos/fotos;
- marketing;
- analytics de terceros;
- app móvil con nuevos identificadores;
- nuevos proveedores;
- multi-tenancy;
- datos sensibles adicionales.
