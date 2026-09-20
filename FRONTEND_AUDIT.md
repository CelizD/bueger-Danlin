# Frontend Audit — Burger Danlin

Base de evaluación: documento interno "Diseño profesional de Frontend para un SaaS: arquitectura, seguridad, UX, rendimiento y operación" y estado actual del repositorio.

## Objetivo

Evolucionar el frontend actual sin sobrearquitectura. Burger Danlin sigue siendo un producto pequeño y debe conservar un frontend modular dentro del mismo repositorio, evitando microfrontends, Redux, GraphQL, WebSockets, PWA o dependencias pesadas mientras no exista una necesidad real.

## Estado actual

| Área | Estado | Evidencia / decisión |
| --- | --- | --- |
| Next.js + React + TypeScript strict | ✅ | Next.js 16, React 19 y tsconfig strict |
| Monolito frontend | ✅ | una sola app web; adecuado para el tamaño actual |
| Modularidad por dominio | 🟡 | varias rutas están separadas, pero páginas cliente grandes concentran datos + estado + UI |
| Frontera server/client | 🟡 | muchas rutas admin son Client Components completos |
| API browser boundary | ✅ inicial | URL base centralizada en `src/lib/api/browser.ts` |
| Design tokens | 🟡 | tokens semánticos base agregados; todavía existe CSS histórico con valores físicos |
| Estados loading/error/404 | ✅ base | estados globales accesibles agregados |
| Responsive | ✅ parcial | reglas mobile/tablet ya existen |
| WCAG 2.2 AA | 🟡 | focus-visible, skip link y reduced-motion agregados; falta auditoría completa |
| Formularios | 🟡 | labels nativos y autocomplete principales; falta validación de campo más específica |
| Sesión de personal | ✅ | cookie HttpOnly administrada por API |
| Token cliente | 🟡 | reducido de localStorage a sessionStorage; sigue siendo una capability accesible a JS |
| CSP | ✅ baseline | CSP de producción agregada; requiere endurecimiento con nonce/hash más adelante |
| Clickjacking | ✅ | X-Frame-Options + CSP frame-ancestors none |
| HTTPS/HSTS | ✅ config | configuración preparada para producción |
| Secretos frontend | ✅ diseño | secretos privados permanecen server-side |
| SEO público | 🟡 | metadata base + Open Graph; sitemap/canonical esperan dominio real |
| Rutas privadas indexables | ✅ | admin y pedido tienen noindex/nofollow + robots disallow |
| Core Web Vitals | 🟡 | arquitectura Next ayuda, pero todavía no existe RUM |
| Lighthouse/bundle budgets | 🔴 | pendiente |
| Testing frontend real | 🟡 | Vitest activado con pruebas de reglas de pedidos, helpers y matriz de roles; faltan componentes/E2E |
| E2E | 🔴 | pendiente Playwright |
| Accessibility automation | 🔴 | pendiente axe |
| Storybook | 🔴 | pendiente cuando se formalice design system |
| Observabilidad frontend | 🔴 | pendiente errores + RUM + Web Vitals |
| CI de tipos/build | ✅ | GitHub Actions ejecuta typecheck/test/build |
| Security scanning | ✅ | audit, Gitleaks, Semgrep y SBOM existentes |

## Fase 1 — Fundaciones seguras

Implementado:

- CSP de producción.
- semántica global de colores/tokens base;
- focus-visible;
- prefers-reduced-motion;
- skip link;
- error boundary;
- loading state;
- 404;
- noindex para admin;
- noindex para /pedido/[orderCode];
- robots policy para rutas privadas;
- metadata/Open Graph base;
- API_URL centralizado;
- customer order token limitado a sessionStorage;
- autocomplete en datos principales del cliente;
- anuncios ARIA para errores/estados críticos.

## Fase 2 — Modularidad por feature

Estado: 🟡 en progreso.

Implementado:

- `features/ordering/types.ts`;
- `features/ordering/api.ts`;
- `features/ordering/formatters.ts`;
- componentes separados para burger builder, bebida, datos del cliente y confirmación/QR;
- `OrderApp` reducido a orquestación de estado/flujo;
- `AdminSidebar` compartido por todo el panel;
- navegación activa con `aria-current="page"`.

Pendiente:

```text
src/
├── app/
├── features/
│   ├── ordering/
│   ├── customer-order/
│   ├── staff-auth/
│   ├── dashboard/
│   ├── kitchen/
│   ├── delivery/
│   ├── inventory/
│   └── staff/
├── components/
│   ├── ui/
│   └── patterns/
├── design-system/
├── lib/
│   ├── api/
│   ├── auth/
│   └── validation/
└── tests/
```

Prioridad:

1. extraer hooks de ordering si la lógica sigue creciendo;
2. centralizar tipos compartidos de sesión/personal;
3. eliminar tipos duplicados de API;
4. normalizar manejo de errores HTTP en el resto del panel;
5. extraer shell/patterns adicionales solo donde exista duplicación real;
6. conservar estado local primero;
7. introducir TanStack Query solo si invalidación/cache del server-state empieza a ser difícil.

## Fase 3 — Testing y accesibilidad

Estado: 🟡 en progreso.

Implementado:

- Vitest en el paquete Web;
- `pnpm test` ya ejecuta pruebas frontend reales;
- tests de cálculo de total;
- tests de capacidad evento/inventario;
- tests de ingredientes agotados;
- tests de payload QR sin PII;
- tests de almacenamiento session-scoped por pedido;
- tests de normalización de errores API;
- tests de matriz de navegación ADMIN/KITCHEN/DELIVERY.

Siguiente subfase:

- Testing Library;
- jsdom;
- Playwright;
- axe;
- pruebas de keyboard;
- smoke tests de roles/permisos;
- E2E de pedido, login/MFA, cocina y entrega;
- E2E de cancelación/pago cuando el proveedor real exista.

No buscar 100% de coverage. Proteger rutas de dinero, permisos y confianza.

## Fase 4 — Rendimiento y observabilidad

Objetivos iniciales:

- LCP p75 <= 2.5 s;
- INP p75 <= 200 ms;
- CLS p75 <= 0.1;
- Lighthouse >= 90 como señal de laboratorio en la ruta pública;
- RUM real en producción;
- Web Vitals por móvil/escritorio;
- errores frontend con release + request ID;
- no registrar contraseñas, tokens, cookies, tarjetas ni PII innecesaria.

Trabajo:

1. instrumentar Web Vitals;
2. error tracking;
3. correlation request ID browser/API;
4. Lighthouse CI;
5. bundle budget;
6. medir Client Component size antes de agregar librerías;
7. lazy-load únicamente cámara/QR y componentes pesados donde aporte.

## Fase 5 — Design system

No migrar todo a Tailwind solo por usar Tailwind.

Primero formalizar:

```text
tokens
  ↓
primitives
  ↓
UI components
  ↓
patterns
  ↓
features
```

Tokens semánticos:

- surface-default
- surface-muted
- text-primary
- text-secondary
- action-primary
- text-danger
- border-muted
- focus-ring

Después:

- Button;
- Input;
- Select;
- Dialog;
- Alert;
- StatusBadge;
- EmptyState;
- LoadingState;
- ConfirmDialog;
- DataTable responsive.

Storybook entra cuando esos componentes ya sean reutilizables y exista valor en documentarlos/probarlos aislados.

## Fase 6 — Seguridad avanzada del frontend

Pendientes:

- reemplazar el capability token de pedido accesible a JS por una sesión cliente HttpOnly/BFF o un diseño equivalente;
- CSP con nonce/hash en lugar de depender de unsafe-inline;
- inventario de scripts de terceros;
- política de sourcemaps;
- revisión XSS/sinks;
- pruebas WSTG;
- DAST contra staging/producción controlada.

La autorización seguirá siendo siempre responsabilidad del API.

## Decisiones explícitas de no complejidad

Por ahora NO introducir:

- microfrontends;
- Redux;
- GraphQL;
- WebSockets;
- PWA/service worker;
- Kubernetes;
- múltiples apps web solo por separar carpetas;
- BFF completo hasta que la sesión cliente o necesidades SSR lo justifiquen.

## Gates antes de producción

Frontend no se considera listo hasta que:

1. `pnpm lint` pase;
2. `pnpm test` tenga pruebas frontend reales;
3. `pnpm build` pase;
4. flujos críticos tengan E2E;
5. WCAG 2.2 AA tenga smoke test manual + automático;
6. CSP esté validada en producción;
7. no existan secretos cliente;
8. rutas privadas permanezcan noindex;
9. Core Web Vitals tengan medición RUM;
10. exista observabilidad de errores sin PII sensible.
