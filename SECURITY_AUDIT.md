# Auditoría de seguridad — Burger Danlin

Fecha de actualización: 2026-09-30

Base de evaluación: controles del documento interno **"Ciberseguridad para diseñar un SaaS seguro"**, complementados con el estado real del repositorio y los workflows actuales.

> **Nota de vigencia:** esta auditoría conserva hallazgos históricos y controles de madurez. Para decidir qué falta para el MVP actual, usar primero `docs/MVP_FINAL_STATUS.md` y `deploy/GO_LIVE_CHECKLIST.md`. El código de pagos, privacidad, ARCO, retención y supply chain avanzó después de la primera versión de esta auditoría.


Leyenda:

- ✅ Cubierto en código/configuración y validado por tests/CI cuando aplica
- 🟡 Implementado parcialmente o requiere validación en infraestructura real
- 🔴 Pendiente antes de producción
- 🔵 No aplica hoy / condicional

> Burger Danlin es actualmente una plataforma de pedidos para un solo negocio, no un SaaS multi-tenant. Los controles de aislamiento de tenants se consideran condicionales hasta que cambie el modelo del producto.

## Resumen ejecutivo

Desde la auditoría inicial se cerraron varios gaps importantes:

- MFA administrativo;
- JWT con algoritmo/issuer/audience explícitos;
- exception filter seguro;
- límites de request;
- OpenAPI;
- CSP en producción;
- CI con PostgreSQL real;
- E2E integrado real;
- SAST con Semgrep;
- SCA con `pnpm audit`;
- Gitleaks;
- SBOM CycloneDX;
- image scanning con Trivy para API, Web y backups;
- Docker non-root;
- DB/Redis privados en Compose de producción;
- backups cifrados y restore drill;
- copia offsite S3-compatible preparada;
- kill switch de pagos reales;
- Prometheus + Loki + Grafana + Alloy preparados para observabilidad.

Los principales riesgos pendientes ya no están en el flujo básico del producto. Se concentran en **operación de producción, observabilidad, seguridad ofensiva, privacidad, respuesta a incidentes y validación de infraestructura real**.

## P0 — Bloqueantes antes de producción

| Control | Estado | Evidencia actual / brecha |
|---|---|---|
| Autenticación de personal | ✅ | Login first-party, Argon2id, sesiones firmadas y cuenta activa validada en servidor |
| MFA administradores | ✅ | TOTP obligatorio, AES-256-GCM, recovery codes, anti-reuse y tests |
| Cookies seguras | ✅ | HttpOnly; Secure + SameSite=Strict en producción |
| Argon2id | ✅ | 19 MiB, 2 iteraciones, paralelismo 1 |
| Benchmark Argon2id en hardware prod | 🟡 | Comando reproducible `pnpm security:benchmark-argon2` implementado; falta ejecutarlo y registrar p50/p95 en el VPS objetivo |
| Password blocklist | ✅ | Política centralizada rechaza contraseñas comunes/triviales al crear/restablecer personal y en el admin seed; no realiza consultas externas de breach data |
| JWT algoritmo/issuer/audience explícitos | ✅ | Configurados y validados en AuthModule |
| RBAC / least privilege | ✅ | ADMIN, KITCHEN, DELIVERY + guards server-side |
| Secrets fuera del repo | ✅ | .env ignorado; Gitleaks verde en CI |
| Secret Manager / Vault | 🔴 | Producción todavía depende de variables/archivo de entorno |
| KMS para claves sensibles | 🔴 | No implementado; MFA usa clave separada en entorno |
| TLS 1.2/1.3 | 🟡 | Nginx/configuración preparada; falta desplegar dominio/certificados reales |
| DB no pública | ✅ | Compose de producción sin host ports; red interna |
| Redis no público | ✅ | Sin host ports, red interna y password |
| Cifrado en reposo | 🟡 | Backups cifrados; cifrado del volumen/infra depende del proveedor final |
| Input validation server-side | ✅ | ValidationPipe whitelist + forbidNonWhitelisted + DTOs |
| SQL parametrizado | ✅ | Prisma domina acceso; raw SQL sensible usa parámetros/valores interpolados por Prisma |
| Rate limit auth | ✅ | 5/min por IP + lockout persistente por cuenta |
| Rate limit API | ✅ | límite global |
| Rate limits por endpoints caros | ✅ | Login/MFA y rutas públicas sensibles de pedidos/pagos tienen límites específicos además del límite global; ajustar valores con métricas reales de carga |
| CORS explícito | ✅ | allowlist de APP_ORIGIN |
| CSRF | ✅ | Origin + Fetch Metadata + SameSite para mutaciones de staff |
| HTTPS obligatorio | 🟡 | FORCE_HTTPS listo; requiere reverse proxy/TLS real |
| Error handling central | ✅ | HttpExceptionFilter, formato uniforme y 5xx sanitizados |
| Límites de payload | ✅ | JSON 256kb y urlencoded 64kb por defecto |
| OpenAPI / inventario de API | ✅ | Swagger UI + docs-json; deshabilitado en prod salvo opt-in |
| CI lint/test/build | ✅ | Workflow activo en PR/push |
| E2E integrado real | ✅ | PostgreSQL + Nest + Next + Chromium: pedido -> pago mock -> cocina -> QR -> entrega |
| Branch protection / review obligatorio | 🟡 | El workflow existe; la integración actual no tiene permiso para confirmar la regla de protección de `main` |
| SCA dependencias | ✅ | `pnpm audit --prod --audit-level=high` verde |
| Secret scanning | ✅ | Gitleaks sobre historial completo verde |
| SAST | ✅ | Semgrep OSS verde |
| Backups automáticos cifrados | 🟡 | Scripts/timers listos; falta ejecutar contra infraestructura final |
| Backup offsite | 🟡 | S3-compatible + Versioning/Object Lock preparados; falta bucket real |
| Restore test aislado | ✅ | Restore drill contra PostgreSQL temporal |
| RPO/RTO | 🟡 | Objetivos RPO <=1h / RTO <=4h; falta simulacro de pérdida total |
| WAF / DDoS edge | 🔴 | No configurado |
| DAST staging | 🟡 | workflow manual OWASP ZAP preparado y restringido al environment `staging`; falta desplegar staging HTTPS y ejecutar baseline + full scan |
| Pentest prelaunch | 🔴 | No realizado |
| Hallazgos críticos abiertos = 0 | 🟡 | CI security está verde; DAST está automatizado pero aún no ejecutado contra staging real; pentest externo sigue pendiente/no bloqueante del MVP |

## P1 — Seguridad de aplicación y operación

| Control | Estado | Evidencia actual / brecha |
|---|---|---|
| Threat model | ✅ | `docs/THREAT_MODEL.md` documenta activos, actores, trust boundaries, escenarios de abuso, amenazas y riesgo residual |
| Inventario de datos | ✅ | `docs/DATA_INVENTORY.md` clasifica PII, secretos, pagos, logs, backups, flujos y accesos por rol |
| Tenant isolation | 🔵 | No aplica mientras sea un solo negocio |
| OIDC/PKCE | 🔵 | No hay IdP/SSO |
| Session invalidation | ✅ | Cada JWT referencia una sesión persistente server-side; logout revoca esa sesión inmediatamente y cambio de contraseña/estado sigue invalidando credenciales |
| Bloqueo tras fallos | ✅ | Persistido en PostgreSQL |
| Headers API | ✅ | Helmet + HSTS prod |
| Headers Web | ✅ | CSP prod, nosniff, DENY frame, Referrer, Permissions, COOP/CORP, HSTS |
| Logs HTTP estructurados | ✅ | requestId, método, path, status, duración, IP y UA; sin bodies |
| AuditLog | ✅ | Matriz formal en `docs/AUDIT_LOG_MATRIX.md`, eventos obligatorios protegidos por test de política y pruebas runtime en flujos críticos; sin PII/tokens en creación de pedido y pagos |
| Logs centralizados/SIEM | 🟡 | Loki + Alloy configurados para logs Docker con retención de 30 días; falta validar ingestión y operación en el VPS real |
| Métricas | 🟡 | API instrumentada + Prometheus + Node Exporter + dashboard Grafana preparados; falta validar targets y consumo en el VPS real |
| Distributed tracing | 🔴 | Falta OpenTelemetry o equivalente |
| Alertas | 🟡 | Reglas Prometheus para API, DB, 5xx, p95, inventario, memoria y disco; falta canal de notificaciones/Alertmanager y validación real |
| Runbooks de incidentes | ✅ | `deploy/runbooks/` cubre account takeover, secret leak, DB exposure, dependency compromise y DDoS/caída operativa; falta ejercitarlos en producción |
| Política de retención | 🟡 | Cleanup/anonimización y purga de AuditLog implementados con dry-run, kill switch, tests y timer preparado; faltan legal hold, logs centralizados, validación offsite y revisión legal/fiscal |
| Privacy inventory/notice | 🟡 | Inventario técnico + aviso integral /privacidad + aviso simplificado en checkout implementados; producción exige identidad, domicilio y correo ARCO. Falta validación legal/fiscal final de plazos de retención |
| Incident contacts | 🟡 | Roles mínimos definidos en `deploy/runbooks/README.md`; falta asignar personas y canales privados reales fuera de Git |
| ASVS baseline | 🔴 | No existe matriz verificable |
| SSRF controls | 🔵 | No existe fetch arbitrario de URLs |
| API versionado | ✅ | `/api/v1` |
| Webhook signature validation | ✅ | Stripe valida raw body firmado; Mercado Pago valida manifest `data.id + x-request-id + ts`; ambos usan HMAC, ventana temporal y comparación timing-safe |
| Webhook idempotency real | ✅ | Mercado Pago persiste eventos únicos por proveedor/huella, reintenta fallidos, deduplica concurrencia, bloquea transiciones regresivas/fuera de orden y no revive pedidos cerrados ante pagos tardíos |
| CSP | ✅ | CSP se aplica en producción desde Next.js |
| Pagos reales deshabilitados por defecto | ✅ | `ENABLE_REAL_PAYMENTS=false`; doble bloqueo antes de persistencia y antes de tráfico externo |

## P2 — DevSecOps / supply chain

| Control | Estado | Evidencia actual / brecha |
|---|---|---|
| Lockfile | ✅ | pnpm-lock.yaml versionado |
| Acciones GitHub fijadas | ✅ | acciones críticas pinneadas por SHA |
| SAST en PR | ✅ | Semgrep |
| SCA en PR | ✅ | pnpm audit |
| Secret scan | ✅ | Gitleaks |
| Dependabot | ✅ | dependencias/workflows/contenedores |
| SBOM | ✅ | CycloneDX en push a main/manual |
| IaC scanning | 🔵 | No existe IaC completo todavía |
| Artifact signing | 🔴 | No implementado |
| Docker app non-root | ✅ | API/Web como usuario no-root; hardening adicional en Compose |
| Image scan | ✅ | Trivy v0.36.0 escanea las imágenes de API, Web y Backup; bloquea vulnerabilidades corregibles HIGH/CRITICAL y la corrida validada del 2026-09-27 quedó verde |
| Imagen por digest | 🔴 | Imágenes de aplicación/release no fijadas por digest |
| DAST | 🟡 | `.github/workflows/dast.yml` preparado con baseline pasivo y full active scan protegido; falta target staging real |
| Deploy con OIDC | 🔴 | No existe pipeline de producción |
| Kubernetes Restricted | 🔵 | No usamos Kubernetes |
| Integrated E2E en CI | ✅ | Seed protegido + PostgreSQL + API + Web + Chromium reales |

## Pagos

Estado actual:

- `MockPaymentProvider` disponible para desarrollo/tests;
- `PaymentProviderRegistry` desacopla proveedor y dominio;
- Mercado Pago Orders API client preparado;
- creación de checkout Mercado Pago implementada;
- webhook Mercado Pago firmado, persistente, deduplicado y reconciliado contra GET /v1/orders/{id};
- getPayment() Mercado Pago conectado;
- `ENABLE_REAL_PAYMENTS=false` por defecto;
- producción puede arrancar con pagos reales deshabilitados;
- ninguna credencial por sí sola habilita tráfico externo.

Implementado adicionalmente:

- refund total real e idempotente de Mercado Pago;
- protección ante pagos tardíos después de expirar/cerrar reserva;
- flujo administrativo para identificar y resolver/reembolsar esos casos.

Pendiente antes de habilitar pagos reales:

1. sandbox/end-to-end con credenciales reales del entorno permitido;
2. prueba de webhook/reintentos/idempotencia contra Mercado Pago;
3. prueba de pago fallido;
4. prueba real de cancelación/refund;
5. activar `ENABLE_REAL_PAYMENTS=true` únicamente después de validar todo lo anterior.

## Controles fuertes actuales

1. Argon2id.
2. MFA obligatorio para administradores.
3. AES-256-GCM para secreto TOTP.
4. Rate limiting + lockout persistente.
5. RBAC server-side.
6. Cookies seguras.
7. Sesiones persistentes revocables server-side; logout invalida inmediatamente el JWT asociado.
8. CORS allowlist.
9. CSRF para panel.
10. CSP/HSTS/Helmet.
11. Error filter y límites de body.
12. OpenAPI.
13. Idempotencia en creación de pedidos y capa de pagos.
14. Transacciones/locks para capacidad e inventario.
15. QR sin PII y capability token hasheado.
16. Webhook signature verification + replay window + límites de headers/IDs + deduplicación persistente + reconciliación canónica + protección ante pagos tardíos.
17. Logs HTTP estructurados.
18. AuditLog.
19. SAST/SCA/Gitleaks/SBOM.
20. E2E integrado real en CI.
21. Docker non-root y redes internas.
22. Backup cifrado + restore drill.
23. Kill switch de pagos reales.
24. Retention cleanup seguro con dry-run, anonimización y purga programable.

## Próximo orden recomendado

### Fase 1 — Identidad

1. Ejecutar el benchmark Argon2id en el VPS objetivo y registrar p50/p95.

### Fase 2 — Supply chain

2. Artifact/image signing cuando exista pipeline de release.

### Fase 3 — Privacidad y ciclo de vida de datos

4. Validar los plazos de retención y el aviso de privacidad antes de producción.
5. Implementar legal/incident hold por registro y alerta de fallo del cleanup.

### Fase 4 — Observabilidad

8. Validar Prometheus/Loki/Alloy/Grafana en el VPS.
9. Añadir canal de notificaciones para alertas.
10. Distributed tracing con OpenTelemetry/Tempo si se requiere.
11. Asignar incident contacts reales y ejecutar un tabletop usando los runbooks versionados.

### Fase 5 — Preproducción

13. ADRs.
14. Load/stress test.
15. Staging.
16. Rollback probado.
17. Ejecutar el workflow DAST preparado: baseline y después full scan autorizado.
18. Infraestructura real: dominio/TLS/WAF.
19. Backup offsite real.
20. Simulacro completo de pérdida del VPS.
21. Pentest.

### Fase 6 — Pagos

22. Completar flujo real de Mercado Pago.
23. Sandbox.
24. Webhooks/reconciliación/refunds.
25. Activación explícita de pagos reales.

## Próximo control

La **password blocklist** y el **image scanning con Trivy** ya están implementados y validados. El benchmark Argon2id queda pendiente hasta disponer del VPS objetivo. Mientras tanto, el **threat model** y el **inventario de datos** ya están documentados. El cleanup de retención ya está implementado con dry-run, tests y timer preparado. La observabilidad base con **Grafana + Prometheus + Loki + Alloy** ya está implementada en configuración. Falta validarla en el VPS y conectar notificaciones. Los runbooks de incidentes ya están versionados; queda asignar contactos reales y ejercitarlos.

## Nota sobre branch protection

El repositorio sí ejecuta CI y Security en PR/push a `main`, pero la integración usada para esta auditoría no tiene permisos para leer la configuración de branch protection de GitHub. Por eso el requisito de review/required checks se mantiene como 🟡 hasta verificarlo desde la configuración del repositorio.
