# Performance & Observability — Burger Danlin

## Objetivo

Medir antes de optimizar. La aplicación debe conservar una experiencia rápida en móvil y permitir correlacionar problemas del navegador con el API sin registrar PII sensible.

## Core Web Vitals

El frontend reporta mediante `useReportWebVitals`:

- LCP;
- INP;
- CLS;
- FCP;
- TTFB.

Destino:

```text
POST /api/v1/telemetry/web-vitals
```

Se registra únicamente información técnica:

- nombre de métrica;
- valor;
- delta;
- rating;
- id técnico de la métrica;
- ruta normalizada;
- tipo de navegación;
- requestId.

Las rutas `/pedido/<codigo>` se convierten a:

```text
/pedido/[orderCode]
```

No enviar nombre, teléfono, correo, tokens, cookies ni contenido libre del error.

## Objetivos iniciales

| Métrica | Objetivo p75 |
| --- | ---: |
| LCP | <= 2.5 s |
| INP | <= 200 ms |
| CLS | <= 0.1 |

Estos objetivos se consideran validados únicamente cuando exista suficiente tráfico real. Datos locales/Lighthouse no sustituyen RUM.

## Client errors

Se capturan:

- route boundary errors;
- `window.error`;
- unhandled promise rejections.

Destino:

```text
POST /api/v1/telemetry/client-error
```

Por privacidad no se envía stack ni mensaje libre del error. Solo:

- clase/nombre técnico;
- digest cuando Next lo entrega;
- ruta normalizada;
- requestId.

## Request correlation

Toda llamada que use `apiFetch()` agrega:

```text
X-Request-Id: <uuid>
```

El API:

1. conserva un ID válido enviado por el navegador;
2. genera uno si falta;
3. lo devuelve como `X-Request-Id`;
4. lo incluye en logs HTTP;
5. lo incluye en errores seguros del API.

Esto permite rastrear navegador -> API -> log sin registrar cuerpos sensibles.

## Lazy loading aplicado

### QR de confirmación

`OrderConfirmation` se carga dinámicamente después de crear el pedido. El bundle que contiene `qrcode.react` no es necesario para la primera vista del menú.

### Cámara

`@zxing/browser` se importa dinámicamente únicamente cuando el personal abre el escáner de Entrega.

## Bundle report

Después de un build:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @burger/web build
& "$env:APPDATA\npm\pnpm.cmd" --filter @burger/web bundle:report
```

El reporte muestra:

- chunks JS más grandes;
- tamaño raw;
- tamaño gzip;
- total de JavaScript estático.

El baseline estable se midió en GitHub Actions sobre el commit de aplicación `44e75500d11d5342ad33d1c353cdc6679e7464b1`:

| Medición | Baseline | Budget CI |
| --- | ---: | ---: |
| Chunk JS más grande (gzip) | 122.2 KB | 145 KB |
| JS estático total (gzip) | 424.1 KB | 490 KB |
| Cantidad de chunks | 25 | informativo |

Los budgets están versionados en `apps/web/bundle-budget.json`. El workflow `Bundle Budget` ejecuta un build real y falla si el chunk más grande o el total gzip superan esos límites.

Los límites dejan margen para cambios normales, pero obligan a revisar una regresión significativa en lugar de permitir crecimiento silencioso. Si un aumento es intencional, primero debe revisarse el reporte y actualizarse el baseline/budget con evidencia del nuevo build.

Para una prueba temporal local todavía se pueden sobrescribir los límites sin modificar el archivo versionado:

```powershell
$env:BUNDLE_MAX_CHUNK_GZIP_KB="145"
$env:BUNDLE_MAX_TOTAL_GZIP_KB="490"
& "$env:APPDATA\npm\pnpm.cmd" --filter @burger/web bundle:report
```

## Checklist para producción

- [x] medir bundle baseline;
- [ ] registrar LCP/INP/CLS reales;
- [ ] calcular p75 por dispositivo/ruta cuando exista volumen suficiente;
- [x] fijar budgets después del baseline;
- [ ] revisar logs `FrontendTelemetry`;
- [ ] configurar alertas cuando exista plataforma de observabilidad;
- [ ] correlacionar incidentes mediante `X-Request-Id`;
- [ ] revisar que telemetría no incluya PII;
- [ ] evaluar error tracking externo solo cuando aporte valor operativo.

## Regla

No agregar una librería de performance/estado/cache solo porque exista. Primero medir el problema, identificar el cuello de botella y después escoger la solución más pequeña que lo corrija.
