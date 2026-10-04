# Frontend Audit — Burger Danlin

Fecha de revisión: **1 de octubre de 2026**

Este documento refleja el **estado actual del frontend**. Ya no debe leerse como un backlog histórico. Para decidir si el MVP puede abrir producción, la fuente principal sigue siendo `docs/MVP_FINAL_STATUS.md` junto con `deploy/GO_LIVE_CHECKLIST.md`.

## 1. Estado general

**El frontend funcional del MVP está completo y validado por CI.**

Los pendientes actuales se dividen en dos grupos:

1. validaciones que requieren dominio, VPS o tráfico real;
2. mejoras de madurez que no bloquean el MVP.

No se consideran pendientes actuales los elementos que ya están implementados y cubiertos por pruebas, aunque aparezcan como faltantes en versiones antiguas de esta auditoría.

## 2. Estado actual por área

| Área | Estado | Evidencia / decisión |
| --- | --- | --- |
| Next.js + React + TypeScript | ✅ | Next.js 16.3.8, React 19 y TypeScript strict |
| Arquitectura frontend | ✅ MVP | una sola app Web modular; no requiere microfrontends ni otra app separada |
| Organización por feature | ✅ MVP | `ordering`, `privacy`, `seller` y `staff`; nuevas extracciones solo si aparece duplicación o crecimiento real |
| API browser boundary | ✅ | URL, request ID y errores HTTP centralizados en `src/lib/api/browser.ts` |
| Design system | ✅ base | tokens semánticos, Button, TextField, Alert, StatusBadge, EmptyState y LoadingState |
| Storybook | ✅ | Docs + addon a11y; build obligatorio en CI |
| Responsive | 🟡 validación final | existen reglas responsive; conviene hacer smoke test manual final en móviles reales antes del lanzamiento |
| Accesibilidad automática | ✅ | Playwright + axe cubren Home, Login y rutas administrativas críticas en CI |
| WCAG 2.2 AA completa | 🟡 | automatización cubre errores serious/critical; todavía conviene revisión manual final de teclado, zoom, contraste y lector de pantalla |
| Formularios críticos | ✅ base | labels, autocomplete y Testing Library en flujos principales |
| Sesión de personal | ✅ | cookie HttpOnly administrada por API |
| Acceso del cliente a pedido | ✅ | cookie HttpOnly + SameSite=Strict; no se guarda capability token en `sessionStorage` |
| CSP de scripts | ✅ endurecida | nonce por request + `strict-dynamic`; `script-src` no permite `unsafe-inline` |
| CSP de estilos | 🟡 madurez | `style-src` mantiene `unsafe-inline` por estilos inline existentes |
| Clickjacking | ✅ | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| HTTPS/HSTS | ✅ config | preparado en código; falta validarlo con TLS real en producción |
| Secretos frontend | ✅ | secretos privados permanecen server-side |
| SEO público | 🟡 producción | metadata + Open Graph listos; sitemap/canonical esperan dominio real |
| Rutas privadas indexables | ✅ | admin y pedido usan noindex/nofollow + robots disallow |
| Core Web Vitals | 🟡 producción | RUM implementado; falta p75 con tráfico real |
| Bundle budgets | ✅ | baseline real: 122.2 KB chunk máximo / 424.1 KB total gzip; CI limita a 145 KB / 490 KB |
| Vitest | ✅ | pruebas de reglas, seguridad de cliente, errores, navegación y componentes |
| Testing Library | ✅ | design system, datos del cliente, Inventario, Sábados y Personal |
| E2E integrado | ✅ | Playwright contra API + PostgreSQL reales en CI |
| Flujo completo de pedido | ✅ | cliente → pago mock → cocina → READY → QR → entrega → DELIVERED |
| MFA / Admin E2E | ✅ | enrolamiento MFA y operaciones administrativas reales cubiertas |
| RBAC negativo | ✅ | 401 sin sesión y 403 entre roles KITCHEN/DELIVERY/Admin |
| Headers de seguridad E2E | ✅ | CSP/nonce verificados sobre respuesta HTML real |
| Observabilidad frontend | 🟡 producción | Web Vitals, errores cliente y request correlation listos; faltan operación y alertas reales |
| CI | ✅ | typecheck, tests, build, Storybook, seed, Playwright y E2E integrado |
| Security scanning | ✅ | audit, Gitleaks, Semgrep, SBOM y Trivy |
| Bundle regression gate | ✅ | workflow dedicado falla cuando el bundle excede límites versionados |

## 3. Arquitectura vigente

La arquitectura actual es adecuada para el tamaño del MVP:

```text
src/
├── app/
├── features/
│   ├── ordering/
│   ├── privacy/
│   ├── seller/
│   └── staff/
├── components/
├── design-system/
└── lib/
    ├── api/
    ├── observability/
    └── security/
```

Decisiones vigentes:

- mantener estado local mientras siga siendo suficiente;
- no introducir Redux o TanStack Query sin una necesidad concreta;
- no separar microfrontends;
- extraer hooks/componentes únicamente cuando exista duplicación o crecimiento real;
- conservar autorización y reglas de negocio en el API.

## 4. Testing y accesibilidad

### Implementado

- Vitest en Web;
- Testing Library + user-event;
- pruebas de componentes del design system;
- pruebas de formularios de cliente, Inventario, Sábados y Personal;
- Playwright integrado contra PostgreSQL/API;
- flujo cliente → cocina → entrega;
- MFA de Admin;
- operaciones Admin de Inventario, Sábados, Personal y ARCO;
- pruebas negativas de RBAC;
- axe en Home y Login;
- axe en Dashboard, Pedidos, Inventario, Sábados, Personal, ARCO, Cocina y Entrega;
- prueba E2E del CSP nonce;
- build de Storybook obligatorio en CI.

### Pendiente antes de abrir producción

No hay un pendiente funcional de testing que bloquee el código del MVP.

Sí conviene ejecutar un smoke test manual final en dispositivos reales para:

- teclado completo;
- zoom 200%;
- contraste visual;
- lector de pantalla en flujos principales;
- responsive en tamaños móviles reales;
- cámara/QR en el dispositivo que se usará para entrega.

Esto complementa la automatización; no sustituye los E2E actuales.

## 5. Rendimiento y observabilidad

### Implementado

- `useReportWebVitals`;
- LCP, INP, CLS, FCP y TTFB;
- rutas normalizadas para evitar códigos de pedido en telemetría;
- `X-Request-Id` browser → API → logs;
- captura de error boundary, `window.error` y unhandled rejections sin stack/PII libre;
- lazy-load de QR;
- lazy-load de cámara;
- reporte raw/gzip de chunks;
- baseline real de bundle;
- budgets versionados;
- gate de bundle dedicado en GitHub Actions.

Baseline actual:

| Métrica | Baseline | Límite CI |
| --- | ---: | ---: |
| Chunk JS más grande (gzip) | 122.2 KB | 145 KB |
| JS estático total (gzip) | 424.1 KB | 490 KB |
| Chunks | 25 | informativo |

### Pendiente de producción

- medir LCP/INP/CLS p75 con tráfico real;
- separar métricas por móvil/escritorio cuando exista volumen suficiente;
- validar dashboard/alertas de telemetría en infraestructura real;
- verificar correlación mediante request ID durante un incidente simulado.

## 6. Seguridad del frontend

### Implementado

- sesión staff HttpOnly;
- acceso de pedido mediante cookie HttpOnly;
- capability de pedido fuera de `sessionStorage`;
- CSP con nonce por request;
- `script-src 'self' 'nonce-…' 'strict-dynamic'`;
- `script-src-attr 'none'`;
- HSTS preparado para producción;
- anti-clickjacking;
- rutas privadas noindex;
- request IDs sin PII;
- pipeline de seguridad.

### Mejoras posteriores no bloqueantes

- migrar estilos inline restantes para retirar `unsafe-inline` de `style-src`;
- definir política de sourcemaps de producción;
- DAST contra staging/producción controlada;
- revisión manual periódica de sinks XSS;
- inventariar scripts de terceros si en el futuro se agrega alguno.

## 7. SEO

Implementado:

- metadata base;
- title template;
- description;
- Open Graph;
- robots;
- noindex/nofollow en rutas privadas.

Pendiente únicamente cuando exista el dominio definitivo:

- configurar `metadataBase`;
- agregar canonical con el dominio real;
- generar sitemap con URLs públicas reales;
- verificar que el sitemap no incluya Admin ni pedidos privados.

No usar `example.com`, localhost ni dominios temporales como canonical.

## 8. Qué ya NO es un pendiente

Estos puntos aparecieron como faltantes en snapshots anteriores y ya están cerrados:

- Testing Library;
- Playwright en CI;
- E2E integrado con API/PostgreSQL;
- axe más allá de Home;
- smoke tests de roles/permisos;
- flujo E2E cliente/cocina/entrega;
- sesión de pedido fuera de `sessionStorage`;
- centralización base de errores HTTP;
- tipos de sesión/personal compartidos;
- Storybook/design system base;
- CSP con nonce para scripts;
- baseline real de bundle;
- bundle budgets automáticos.

No volver a tratarlos como backlog salvo que una regresión los rompa.

## 9. Gates del frontend antes de producción

### Cerrados en código/CI

- [x] `pnpm lint`;
- [x] `pnpm test`;
- [x] `pnpm build`;
- [x] Storybook build;
- [x] flujos críticos E2E;
- [x] E2E integrado API/PostgreSQL;
- [x] axe automático en rutas públicas y administrativas críticas;
- [x] CSP nonce verificada por E2E;
- [x] ausencia de capability de pedido en `sessionStorage`;
- [x] rutas privadas noindex;
- [x] telemetría sin PII libre;
- [x] bundle baseline;
- [x] bundle budgets obligatorios.

### Requieren producción o validación manual

- [ ] smoke test manual final de accesibilidad/responsive;
- [ ] validar CSP/HSTS sobre HTTPS real;
- [ ] medir Core Web Vitals p75 con tráfico real;
- [ ] validar alertas/operación de observabilidad;
- [ ] configurar sitemap + canonical con el dominio real de producción.

## 10. Mejoras de madurez, no bloqueantes del MVP

No son requisito para lanzar el MVP actual:

- Lighthouse CI como gate estricto;
- OpenTelemetry/Tempo;
- error tracking externo;
- DAST;
- pentest externo;
- WAF/CDN;
- eliminación total de `unsafe-inline` en estilos;
- más primitives del design system;
- TanStack Query;
- PWA;
- microfrontends.

Se deben introducir únicamente cuando el tráfico, riesgo o complejidad lo justifiquen.

## 11. Fuente de verdad

Para saber qué falta para lanzar:

1. `docs/MVP_FINAL_STATUS.md`;
2. `deploy/GO_LIVE_CHECKLIST.md`;
3. este documento para el estado técnico del frontend;
4. `PERFORMANCE_OBSERVABILITY.md` para métricas/budgets.

Si un documento histórico contradice estas fuentes, prevalece el estado validado por el código y CI actuales.
