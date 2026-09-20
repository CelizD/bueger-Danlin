# Backend Audit — Burger Danlin

Fecha: 2026-09-19

Base: "Backend para un SaaS bien diseñado: requisitos, arquitectura, prácticas y checklist completos".

Leyenda:

- ✅ Cubierto en código/configuración actual
- 🟡 Parcial / requiere validación o endurecimiento
- 🔴 Falta
- 🔵 No aplica al producto actual
- P0 = imprescindible antes o inmediatamente después de producción
- P1 = necesario para crecimiento profesional
- P2 = optimización/madurez

> Burger Danlin es actualmente una aplicación de pedidos para un solo negocio, no un SaaS multi-tenant. Los controles de tenant se dejan como no aplicables hasta que el producto cambie de modelo.

## P0 — Arquitectura y datos

| Control | Estado | Evaluación |
|---|---|---|
| Arquitectura modular con ownership claro | ✅ | Nest organizado por auth, admin, catalog, pickup-events, orders, payments, inventory y staff |
| Monolito modular antes que microservicios | ✅ | Un solo API Nest; no se introdujo complejidad distribuida innecesaria |
| Identidad de tenant verificada server-side | 🔵 | No existe multi-tenancy actualmente |
| Tablas tenant-scoped identificadas | 🔵 | No existe multi-tenancy actualmente |
| Tests cross-tenant | 🔵 | No aplica mientras siga siendo un solo negocio |
| PostgreSQL como fuente de verdad | ✅ | Pedidos, capacidad, inventario, auth y pagos se apoyan en PostgreSQL |
| Constraints e índices básicos | ✅ | PK, unique e índices en usuarios, pedidos, pagos, eventos, inventario y auditoría |
| Constraints de dominio adicionales | 🟡 | Faltan CHECK SQL explícitos para algunos invariantes numéricos (cantidades/dinero >= 0) |
| Concurrencia | ✅ | SELECT ... FOR UPDATE para capacidad, inventario, pago y operaciones sensibles |
| Idempotencia de órdenes | ✅ | requestKey único + requestHash; replay seguro y detección de reutilización distinta |
| Idempotencia de pagos | ✅ | Payment.idempotencyKey único; confirmación mock idempotente |
| Migraciones | 🟡 | Prisma migrations versionadas; falta política formal expand → migrate → contract para producción |

## P0 — API

| Control | Estado | Evaluación |
|---|---|---|
| REST versionada | ✅ | prefijo /api/v1 |
| OpenAPI como contrato | 🔴 | No hay @nestjs/swagger ni spec OpenAPI |
| Validación mediante schemas/DTO | ✅ | ValidationPipe whitelist + forbidNonWhitelisted + class-validator |
| Validación semántica | ✅ | Productos/modificadores, capacidad, fechas, estados e inventario se revalidan server-side |
| Request size limit explícito | 🔴 | No hay límite JSON/body documentado/configurado |
| Error responses sin detalles internos | ✅ | filtro global normaliza errores, oculta mensajes internos 5xx e incluye requestId |
| Idempotency-Key en POST sensible | ✅ | Creación de pedido |
| Rate limit login/API crítica | ✅ | throttler global + login reforzado + lockout persistente |
| CORS allowlist | ✅ | APP_ORIGIN |
| CSRF | ✅ | Origin + Fetch Metadata para mutaciones de staff |
| Webhook signature validation | ✅ | Stripe y Mercado Pago preparados |
| Webhook handlers reales | 🔴 | Aún no existen porque pagos reales aún no están integrados |
| API inventory documentado/machine-readable | 🟡 | rutas conocidas en código/README; falta OpenAPI |

## P0 — Identidad y autorización

| Control | Estado | Evaluación |
|---|---|---|
| Argon2id | ✅ | 19 MiB, 2 iteraciones, paralelismo 1 |
| MFA ADMIN | 🟡 | TOTP + recovery codes implementado; pendiente validar lint/migración/login local |
| Sesión segura | ✅ | HttpOnly; Secure/SameSite Strict en producción; JWT expiración 8h |
| JWT validation | ✅ | algoritmo, issuer, audience y exp fijados |
| Invalidación de sesión | ✅ | password change mediante credentialVersion + active/role consultado en DB |
| RBAC server-side | ✅ | ADMIN/KITCHEN/DELIVERY + guards |
| Deny-by-default | 🟡 | guards cubren áreas administrativas; falta suite automática negativa por endpoint |
| Autorización por recurso | 🟡 | customer order token y staff roles existen; falta matriz automatizada de authz |
| Bloqueo de login | ✅ | 5 fallos → 15 min persistente |
| Password blocklist | 🔴 | No implementada |
| Benchmark Argon2id | 🔴 | No documentado en hardware objetivo |

## P0 — Seguridad/transporte

| Control | Estado | Evaluación |
|---|---|---|
| TLS obligatorio | 🟡 | FORCE_HTTPS + ejemplo Nginx; falta desplegar certificados reales |
| Secrets fuera de Git | ✅ | .env ignorado, placeholders solamente en .env.example |
| Secret manager producción | 🔴 | Variables de entorno todavía; falta Vault/secret manager |
| Headers de seguridad | ✅ | Helmet + headers Next |
| Cookies Secure | ✅ | producción |
| Logs sin secretos/bodies | ✅ | middleware HTTP no registra cuerpos ni cookies |
| DB no pública en producción | 🔴 | docker-compose local publica 5432; falta manifiesto de producción privado |
| Redis no público en producción | 🔴 | docker-compose local publica 6379; falta red privada producción |
| Encryption at rest | 🟡 | depende del proveedor; MFA secret sí usa AES-256-GCM |

## P0 — Operación y recuperación

| Control | Estado | Evaluación |
|---|---|---|
| Logs estructurados + request ID | ✅ | requestId, método, path, status, duración, IP, UA |
| Audit log | 🟡 | cubre múltiples acciones administrativas/auth; falta matriz de cobertura formal |
| Health check | ✅ | /health y /health/live confirman liveness sin depender de servicios externos |
| Readiness check | ✅ | /health/ready ejecuta SELECT 1 contra PostgreSQL y devuelve 503 si DB no está disponible |
| Backups automáticos | 🔴 | no implementados para Burger Danlin |
| Restore probado | 🔴 | no existe restore drill |
| RPO/RTO | 🔴 | no definidos |
| Runbook incidente crítico | 🔴 | no existe |
| Alertas | 🔴 | no existe canal/reglas de alerting |
| SLO/SLI | 🔴 | no definidos |

## P0 — CI/CD y testing

| Control | Estado | Evaluación |
|---|---|---|
| Lint/typecheck | ✅ | scripts disponibles |
| Unit tests | 🟡 | Vitest configurado; cobertura insuficiente/no existe suite P0 completa |
| Integration tests | 🔴 | falta suite DB/flujo reproducible en CI |
| Authorization negative tests | 🔴 | faltan |
| Concurrency tests | 🔴 | faltan para capacidad/inventario/pago |
| CI automatizado | 🔴 | no hay workflows versionados |
| Dependency scanning | 🔴 | no hay Dependabot/SCA |
| Secret scanning en pipeline | 🔴 | no hay pipeline |
| SAST | 🔴 | no configurado |
| Build reproducible | 🟡 | lockfile versionado; falta pipeline + imagen/artefacto reproducible |
| Docker app non-root | 🔴 | no hay Dockerfiles de producción de web/API |
| Container scan | 🔴 | no configurado |
| Deploy reproducible | 🔴 | Nginx ejemplo existe, pero falta procedimiento/artefacto automatizado |

## P1 — Fiabilidad y observabilidad

| Control | Estado | Evaluación |
|---|---|---|
| Redis como optimización, no verdad | ✅ | actualmente no participa en flujo crítico |
| Workers idempotentes | 🔵 | no hay workers productivos todavía |
| Timeouts antes de retries | 🔴 | aún no hay clientes externos reales; aplicar al integrar Stripe/MP/email |
| Retry limitado + backoff + jitter | 🔴 | pendiente integraciones reales |
| Circuit breaker | 🔵 | aplicar solo donde exista dependencia remota problemática |
| DLQ | 🔵 | no existe cola productiva todavía |
| OpenTelemetry | 🔴 | no implementado |
| Métricas HTTP p50/p95/p99 | 🔴 | no implementadas |
| Métricas DB/cache/runtime | 🔴 | no implementadas |
| Dashboard sistema | 🔴 | dashboard actual es de negocio, no observabilidad |
| SLO/error budget | 🔴 | no definidos |
| Logs centralizados | 🔴 | consola + AuditLog; no Loki/ELK/servicio administrado |

## P1/P2 — Escala

| Control | Estado | Evaluación |
|---|---|---|
| Stateless API | ✅ | sesión JWT en cookie; estado persistente en DB |
| Autoscaling | 🔵 | no necesario para MVP actual |
| Particionado | 🔵 | no justificado por volumen actual |
| Sharding | 🔵 | no justificado |
| Microservicios | 🔵 | no justificados |
| CQRS | 🔵 | no justificado |
| Multi-region | 🔵 | no justificado |

## Fortalezas actuales

1. Monolito modular adecuado al tamaño actual.
2. PostgreSQL como fuente de verdad.
3. Locks transaccionales para evitar sobreventa.
4. Idempotencia real en creación de pedidos.
5. Inventario transaccional.
6. Pricing calculado por backend.
7. ValidationPipe estricto.
8. Roles server-side.
9. MFA administrativo en proceso de validación.
10. Rate limiting y bloqueo persistente.
11. QR sin PII.
12. Webhook signature verification preparada.
13. Logs HTTP estructurados.
14. AuditLog de operaciones críticas.
15. API versionada bajo /api/v1.

## Orden recomendado de cierre

### Fase A — P0 inmediato
1. Health + readiness real.
2. Error filter consistente con requestId.
3. Request body size limit.
4. CI lint/test/build.
5. Tests negativos de authz.
6. Tests de concurrencia capacidad/inventario.
7. OpenAPI.
8. Dependabot/SCA + secret scanning.

### Fase B — Producción
9. Dockerfiles production non-root.
10. Deploy reproducible.
11. Backups automáticos cifrados.
12. Restore drill.
13. RPO/RTO.
14. DB/Redis privados.
15. Secret manager.
16. Runbook incidente crítico.

### Fase C — Operabilidad
17. OpenTelemetry.
18. Métricas HTTP/DB/runtime.
19. Alertas.
20. SLO/SLI/error budget.
21. Logs centralizados.

## Próximo control

**Request body size limit explícito**: health/readiness y error handling ya quedaron cubiertos. El siguiente P0 de API es fijar límites de payload antes del parser.
