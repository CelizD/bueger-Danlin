# Auditoría de seguridad — Burger Danlin

Fecha: 2026-09-19

Base de evaluación: informe interno "Ciberseguridad para diseñar un SaaS seguro", especialmente el checklist de salida a producción de las páginas 33–34.

Leyenda:

- ✅ Cubierto en código/configuración actual
- 🟡 Parcial o requiere validación en infraestructura real
- 🔴 Falta antes de producción
- 🔵 No aplica hoy / condicional

> Burger Danlin es actualmente una plataforma de pedidos de un solo negocio, no un SaaS multi-tenant. Los controles de aislamiento de tenants se consideran condicionales hasta que el producto cambie de modelo.

## P0 — Bloqueantes antes de producción

| Control | Estado | Evidencia actual / brecha |
|---|---|---|
| Autenticación de personal | ✅ | Login propio, Argon2id, sesión firmada, cuenta activa validada en cada request |
| MFA administradores | 🟡 | TOTP obligatorio + códigos de recuperación implementados; pendiente aplicar migración y validar flujo local |
| Cookies seguras | ✅ | HttpOnly; Secure + SameSite=Strict en producción |
| Argon2id | ✅ | 19 MiB, 2 iteraciones, paralelismo 1 |
| Benchmark Argon2id en hardware prod | 🔴 | Parámetros cumplen baseline, pero no existe benchmark documentado |
| Password blocklist | 🔴 | No se contrastan contraseñas comunes/comprometidas |
| JWT algoritmo/issuer/audience explícitos | 🟡 | HS256, issuer y audience ya fijados en código; pendiente validación local del build/login |
| RBAC / least privilege | ✅ | ADMIN, KITCHEN, DELIVERY + guards server-side |
| Secrets fuera del repo | ✅ | .env ignorado; no se guardan credenciales reales en Git |
| Secret Manager / Vault | 🔴 | Producción todavía usa variables de entorno; falta gestor de secretos |
| KMS para claves sensibles | 🔴 | No implementado |
| TLS 1.2/1.3 | 🟡 | Nginx de referencia preparado; requiere desplegar certificados/configuración real |
| DB no pública | 🟡 | docker-compose.prod.yml mantiene PostgreSQL sin host ports en red internal; pendiente despliegue/verificación VPS |
| Redis no público | 🟡 | docker-compose.prod.yml mantiene Redis sin host ports, red internal y password; pendiente despliegue/verificación VPS |
| Cifrado en reposo | 🟡 | Depende del proveedor de DB/backups; no hay evidencia/configuración en repo |
| Input validation server-side | ✅ | ValidationPipe whitelist + forbidNonWhitelisted + DTOs |
| SQL parametrizado | 🟡 | Prisma domina el acceso; existen algunos raw queries parametrizados que deben mantenerse auditados |
| Rate limit auth | ✅ | 5/min por IP + lockout persistente por cuenta |
| Rate limit API | ✅ | límite global inicial 120/min |
| Rate limits por endpoints caros | 🟡 | Login está especializado; otras operaciones costosas no tienen límites específicos |
| CORS explícito | ✅ | APP_ORIGIN allowlist |
| CSRF | ✅ | Origin + Fetch Metadata + SameSite en mutaciones de staff |
| HTTPS obligatorio | 🟡 | FORCE_HTTPS y ejemplo Nginx listos; falta infraestructura/certificados reales |
| Error handling central | 🟡 | Nest no expone stack 500 por defecto; falta exception filter propio + códigos consistentes |
| CI con review obligatorio | 🔴 | No hay evidencia de pipeline/branch protection en el repo |
| SCA dependencias | 🟡 | pnpm audit de producción + Dependabot configurados; pendiente primer workflow verde |
| Secret scanning | 🟡 | Gitleaks v3 escanea historial en push/PR/schedule; pendiente primer workflow verde |
| Backups automáticos cifrados | 🟡 | pg_dump + age + checksum + systemd timer implementados; falta primer backup real y copia offsite/inmutable |
| Restore test real | 🟡 | drill aislado contra PostgreSQL temporal implementado; falta ejecutar y registrar duración real |
| RPO/RTO acordados | 🔴 | No definidos |
| WAF / DDoS edge | 🔴 | No configurado |
| Pentest prelaunch | 🔴 | No realizado |
| Hallazgos críticos abiertos = 0 | 🔴 | Requiere pentest/DAST/SCA/SAST y proceso de cierre |

## P1 — MVP de seguridad recomendado

| Control | Estado | Evidencia actual / brecha |
|---|---|---|
| Threat model | 🔴 | No existe documento formal de activos, trust boundaries y amenazas |
| Inventario de datos | 🔴 | No existe mapa formal de PII/datos/proveedores/retención |
| Tenant isolation | 🔵 | No aplica mientras Burger Danlin siga siendo un solo negocio |
| OIDC/PKCE | 🔵 | Login propio first-party; aplicar si se introduce IdP/SSO |
| Session invalidation | ✅ | Cambio de contraseña invalida JWT anterior mediante credentialVersion |
| Bloqueo tras fallos | ✅ | 5 fallos → bloqueo 15 min persistido en PostgreSQL |
| Headers de seguridad API | ✅ | Helmet + HSTS prod |
| Headers de seguridad Next | ✅ | nosniff, DENY frame, Referrer, Permissions, COOP/CORP, HSTS prod |
| Logs HTTP estructurados | ✅ | requestId, método, path, status, duración, IP, UA; sin body |
| AuditLog de operaciones críticas | 🟡 | Muchos cambios admin/pedidos están auditados; falta cobertura completa de login success/failure, authz denied, rate-limit |
| Logs centralizados/SIEM | 🔴 | Solo consola/DB local |
| Alertas | 🔴 | No hay reglas ni canal de alertas |
| Runbooks incidentes | 🔴 | No hay runbooks account takeover/breach/secret/DDoS |
| Política de retención | 🔴 | No definida para pedidos, clientes, logs, AuditLog |
| Privacy inventory/notice | 🔴 | No documentado para nombre/teléfono/email |
| Incident contacts | 🔴 | No definidos |
| ASVS baseline | 🔴 | No existe matriz ASVS verificable |
| SSRF controls | 🔵 | No existe hoy funcionalidad que haga fetch arbitrario de URLs; revisar al agregar integraciones |
| API inventory/versionado | 🟡 | API está bajo /api/v1; falta inventario machine-readable/OpenAPI |
| Body size limits | 🔴 | No hay límite explícito de JSON/request documentado |
| Webhook signature validation | ✅ | Servicio Stripe/Mercado Pago con HMAC, raw body, timestamp y timingSafeEqual |
| Webhook idempotency real | 🟡 | Diseño de pagos usa idempotency; handlers reales aún no existen |
| CSP | 🔴 | No se configuró CSP estricta; Helmet la tiene desactivada para evitar romper Next durante MVP |

## P2 — DevSecOps / supply chain

| Control | Estado | Evidencia actual / brecha |
|---|---|---|
| Lockfile | ✅ | pnpm-lock.yaml versionado |
| SAST en PR | 🟡 | Semgrep OSS 1.177.0 configurado en push/PR/schedule; pendiente primer workflow verde |
| SCA en PR | 🟡 | pnpm audit --prod --audit-level=high configurado; pendiente primer workflow verde |
| Dependabot/equivalente | ✅ | monitorea pnpm, GitHub Actions y Docker Compose |
| IaC scanning | 🔵 | Aplicará cuando haya IaC de producción |
| SBOM por release | 🟡 | CycloneDX generado automáticamente en push a main y ejecución manual; falta asociarlo a releases formales |
| Artifact signing | 🔴 | No implementado |
| Docker app non-root | 🟡 | API/Web usan USER node, no-new-privileges y cap_drop en compose; pendiente build/run real |
| Image scan | 🔴 | No configurado |
| Imagen por digest | 🔴 | No existe imagen de aplicación de producción |
| DAST staging | 🔴 | No configurado |
| Deploy con identidad OIDC | 🔴 | No existe pipeline de producción |
| Kubernetes Restricted | 🔵 | No usamos Kubernetes y el informe recomienda no introducirlo sin necesidad |

## Controles ya fuertes

1. Argon2id con baseline OWASP.
2. Contraseñas nunca almacenadas en claro.
3. Rate limit + bloqueo persistente de login.
4. Roles ADMIN/KITCHEN/DELIVERY aplicados en API.
5. Sesiones invalidadas al cambiar contraseña o desactivar usuario.
6. Cookies HttpOnly y endurecidas en producción.
7. CORS allowlist.
8. Protección CSRF del panel.
9. Headers Helmet/Next.
10. HTTPS enforcement preparado.
11. Validación server-side y precios calculados por backend.
12. Idempotencia en creación/pagos.
13. Inventario/capacidad con transacciones y locks.
14. QR sin PII con token verificado.
15. Validación fuerte de firmas de webhook preparada.
16. Logs HTTP sin request bodies/secrets.
17. AuditLog para múltiples operaciones administrativas.

## Orden de implementación recomendado

### Fase 1 — Identidad
1. MFA obligatorio para ADMIN.
2. Fijar JWT algorithm + issuer + audience.
3. Password blocklist y política de 15+ caracteres mientras no haya MFA.
4. Benchmark Argon2id.

### Fase 2 — API
5. Exception filter seguro con requestId.
6. Límites de tamaño de request.
7. Rate limits específicos para endpoints críticos/caros.
8. OpenAPI + inventario de endpoints.
9. Tests negativos de autorización.

### Fase 3 — CI/CD
10. Workflow CI con lint/test/build.
11. SCA/Dependabot.
12. Secret scanning.
13. SAST.
14. SBOM.
15. Dockerfiles production non-root + image scan.

### Fase 4 — Infraestructura
16. Secret manager.
17. DB/Redis solo red privada.
18. TLS real.
19. WAF/CDN.
20. Backups cifrados automáticos.
21. Restore drill y RPO/RTO.

### Fase 5 — Operaciones de seguridad
22. Logs centralizados.
23. Alertas.
24. Runbooks.
25. Política de retención/privacidad.
26. ASVS baseline.
27. DAST + pentest prelaunch.
28. Tabletop de incidente.

## Próximo control

**Password blocklist + política de contraseñas** es el siguiente gap de identidad después de validar MFA. Luego siguen exception filter/límites de request y CI security.
