# Backend Audit — Burger Danlin

> **Snapshot histórico:** este documento refleja principalmente el estado del **19 de septiembre de 2026** y conserva pendientes que posteriormente fueron resueltos. No usarlo como lista vigente de lanzamiento. La fuente actual es `docs/MVP_FINAL_STATUS.md` junto con `deploy/GO_LIVE_CHECKLIST.md`.


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
| Constraints de dominio adicionales | ✅ | CHECK SQL versionados para cantidades, montos, intentos y reglas numéricas de entrega; CI verifica que estén presentes y validados |
| Concurrencia | ✅ | SELECT ... FOR UPDATE para capacidad, inventario, pago y operaciones sensibles |
| Idempotencia de órdenes | ✅ | requestKey único + requestHash; replay seguro y detección de reutilización distinta |
| Idempotencia de pagos | ✅ | Payment.idempotencyKey único; confirmación mock idempotente |
| Migraciones | ✅ | Prisma migrations versionadas + política formal Expand → Migrate → Contract; producción usa migrate deploy, migraciones aplicadas son inmutables y PRs clasifican cambios de DB |

## P0 — API

| Control | Estado | Evaluación |
|---|---|---|
| REST versionada | ✅ | prefijo /api/v1 |
| OpenAPI como contrato | ✅ | Swagger/OpenAPI + plugin DTO implementados; lockfile/build validados en CI |
| Validación mediante schemas/DTO | ✅ | ValidationPipe whitelist + forbidNonWhitelisted + class-validator |
| Validación semántica | ✅ | Productos/modificadores, capacidad, fechas, estados e inventario se revalidan server-side |
| Request size limit explícito | ✅ | JSON 256kb y urlencoded 64kb configurados explícitamente antes de DTO validation |
| Error responses sin detalles internos | ✅ | filtro global normaliza errores, oculta mensajes internos 5xx e incluye requestId |
| Idempotency-Key en POST sensible | ✅ | Creación de pedido |
| Rate limit login/API crítica | ✅ | throttler global + login reforzado + lockout persistente |
| CORS allowlist | ✅ | APP_ORIGIN |
| CSRF | ✅ | Origin + Fetch Metadata para mutaciones de staff |
| Webhook signature validation | ✅ | Mercado Pago valida HMAC + ventana anti-replay; Stripe queda fuera del alcance del MVP |
| Webhook handlers reales | ✅ | Mercado Pago persiste/deduplica eventos, reconcilia estado canónico y protege pagos tardíos |
| API inventory documentado/machine-readable | ✅ | Swagger/OpenAPI disponible fuera de producción por defecto |

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
| Secret manager producción | 🟡 | API preparada para secretos file-backed + gate exige backend externo; falta desplegar Vault/Secret Manager/KMS real y migrar credenciales de infraestructura restantes |
| Headers de seguridad | ✅ | Helmet + headers Next |
| Cookies Secure | ✅ | producción |
| Logs sin secretos/bodies | ✅ | middleware HTTP no registra cuerpos ni cookies |
| DB no pública en producción | ✅ | compose de producción validado sin host port para PostgreSQL; red Docker internal |
| Redis no público en producción | ✅ | compose de producción validado sin host port para Redis; red internal y password requerido |
| Encryption at rest | 🟡 | depende del proveedor; MFA secret sí usa AES-256-GCM |

## P0 — Operación y recuperación

| Control | Estado | Evaluación |
|---|---|---|
| Logs estructurados + request ID | ✅ | requestId, método, path, status, duración, IP, UA |
| Audit log | 🟡 | cubre múltiples acciones administrativas/auth; falta matriz de cobertura formal |
| Health check | ✅ | /health y /health/live confirman liveness sin depender de servicios externos |
| Readiness check | ✅ | /health/ready ejecuta SELECT 1 contra PostgreSQL y devuelve 503 si DB no está disponible |
| Backups automáticos | 🟡 | pg_dump + age + checksum validados; timer horario y flujo S3/Object Lock implementados; pendiente verificar bucket offsite real |
| Restore probado | ✅ | restore drill aislado ejecutado correctamente contra PostgreSQL temporal; timer mensual implementado |
| RPO/RTO | 🟡 | objetivos técnicos definidos: RPO <= 1h y RTO <= 4h; pendiente validar RTO con simulacro de pérdida total del VPS |
| Runbook incidente crítico | 🔴 | no existe |
| Alertas | 🔴 | no existe canal/reglas de alerting |
| SLO/SLI | 🔴 | no definidos |

## P0 — CI/CD y testing

| Control | Estado | Evaluación |
|---|---|---|
| Lint/typecheck | ✅ | scripts disponibles |
| Unit tests | 🟡 | Vitest configurado; cobertura insuficiente/no existe suite P0 completa |
| Integration tests | 🔴 | falta suite DB/flujo reproducible en CI |
| Authorization negative tests | 🟡 | tests de AdminGuard/RolesGuard agregados; pendiente ejecución local/CI |
| Concurrency tests | 🟡 | carreras PostgreSQL agregadas para último combo e inventario compartido; falta ampliar a pago y validar CI |
| CI automatizado | 🟡 | GitHub Actions versionado con PostgreSQL, migrate deploy, lint, test y build; pendiente primer run verde |
| Dependency scanning | 🟡 | Dependabot + pnpm audit configurados; pendiente primer workflow verde |
| Secret scanning en pipeline | 🟡 | Gitleaks v3 configurado contra historial Git; pendiente primer workflow verde |
| SAST | 🟡 | Semgrep OSS 1.177.0 configurado; pendiente primer workflow verde |
| Build reproducible | 🟡 | CI usa pnpm frozen lockfile y build; falta imagen/artefacto productivo reproducible |
| Docker app non-root | ✅ | Dockerfiles multi-stage API/Web construidos y ejecutados correctamente como usuario node |
| Container scan | 🔴 | no configurado |
| Deploy reproducible | ✅ | docker-compose.prod.yml + Dockerfiles + migración + runbook versionados; build y arranque local de producción validados |

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

**Dependency + secret scanning**: payload limits, OpenAPI, tests base y CI ya están implementados pendientes de validación. El siguiente P0 es automatizar SCA/Dependabot y secret scanning.
