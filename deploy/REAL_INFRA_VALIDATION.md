# Validación en infraestructura real

Este documento define la evidencia que debe recopilarse en el **VPS, dominio y tráfico reales** antes de considerar cerrados los controles que no pueden validarse únicamente con CI.

No se debe marcar esta validación como completada desde un entorno local.

## Estado actual

El repositorio ya tiene preparada la instrumentación necesaria para:

- HTTPS/HSTS y reverse proxy;
- benchmark reproducible de Argon2id;
- RUM de LCP, INP y CLS;
- E2E y accesibilidad automática;
- reglas responsive;
- health/readiness.

Todavía requieren evidencia real:

- TLS/certificados sobre el dominio definitivo;
- benchmark Argon2id sobre el hardware objetivo;
- Core Web Vitals p75 con usuarios reales;
- smoke test final responsive/accesibilidad/cámara en dispositivos reales.

## 1. TLS, HTTPS y headers reales

Después de configurar dominio, DNS, Nginx y certificados, ejecutar desde una máquina externa al VPS:

```bash
WEB_ORIGIN=https://TU_DOMINIO_WEB \
API_ORIGIN=https://TU_DOMINIO_API \
sh deploy/vps/validate-public-endpoints.sh
```

El script valida:

- Web accesible mediante HTTPS con verificación normal de CA/hostname;
- API `/api/v1/health/ready` accesible mediante HTTPS;
- redirect HTTP → HTTPS;
- TLS 1.2;
- TLS 1.3;
- certificado con más de 7 días de vigencia;
- hostname del certificado cuando la versión de OpenSSL lo soporta;
- HSTS;
- CSP del frontend;
- `X-Content-Type-Options`;
- `X-Frame-Options` en Web.

### Criterio de cierre

Este bloque queda ✅ únicamente cuando el script termina sin `FAIL` usando los dominios definitivos y desde una red externa.

Registrar:

```text
fecha:
commit/release:
WEB_ORIGIN:
API_ORIGIN:
proveedor TLS:
resultado: PASS/FAIL
observaciones:
```

No guardar claves privadas, cookies ni tokens en la evidencia.

## 2. Benchmark Argon2id en el VPS objetivo

El benchmark ya está implementado:

```bash
ARGON2_BENCHMARK_RUNS=20 \
ARGON2_BENCHMARK_WARMUPS=3 \
pnpm security:benchmark-argon2
```

Debe ejecutarse en el VPS que realmente alojará la aplicación, con la configuración final de CPU/RAM y sin otra prueba de carga simultánea.

El reporte contiene:

- modelo de CPU;
- CPUs lógicas;
- versión de Node;
- parámetros Argon2id;
- p50/p95 de hash;
- p50/p95 de verify;
- promedio/mínimo/máximo.

Los parámetros esperados siguen siendo:

```text
argon2id
memoryCost = 19456 KiB
timeCost = 2
parallelism = 1
```

### Criterio de revisión

Como umbral operativo inicial del proyecto:

- p95 de hash y verify debe permanecer por debajo de **750 ms**;
- ninguna degradación debe provocar saturación sostenida del VPS durante logins normales;
- si el resultado supera el umbral, revisar capacidad del VPS y carga antes de modificar Argon2id;
- **no reducir automáticamente los parámetros de seguridad solo para hacer pasar el benchmark**.

Guardar el JSON del resultado en el registro operativo fuera de Git si contiene información que permita identificar infraestructura interna. En el repo solo debe registrarse el resumen no sensible.

## 3. Core Web Vitals con tráfico real

El frontend ya envía:

```text
LCP
INP
CLS
FCP
TTFB
```

a:

```text
POST /api/v1/telemetry/web-vitals
```

Los eventos aparecen en los logs del API con el logger:

```text
FrontendTelemetry
```

y Loki/Alloy puede centralizarlos en producción.

### Objetivos p75

| Métrica | Objetivo |
| --- | ---: |
| LCP | <= 2.5 s |
| INP | <= 200 ms |
| CLS | <= 0.1 |

### Regla de evidencia

No declarar este bloque como aprobado con Lighthouse local.

Para la primera validación del MVP:

- recopilar al menos **50 muestras válidas por métrica** antes de declarar un p75 estable;
- preferir una ventana de al menos **7 días** si el tráfico lo permite;
- separar móvil/escritorio cuando exista suficiente volumen;
- revisar especialmente Home, checkout y administración de pedido;
- si hay menos muestras, marcar el resultado como **datos insuficientes**, no como PASS.

Registrar:

```text
ventana:
n LCP:
LCP p75:
n INP:
INP p75:
n CLS:
CLS p75:
porcentaje móvil:
rutas con peor resultado:
resultado: PASS / FAIL / DATOS INSUFICIENTES
```

La ruta de pedido ya se normaliza como `/pedido/[orderCode]` para evitar almacenar códigos reales en telemetría.

## 4. Smoke test responsive final

La automatización actual cubre E2E, axe y flujos críticos, pero la validación final debe incluir interacción real.

### Cliente móvil

Probar en al menos un teléfono Android real con Chrome:

- Home sin scroll horizontal;
- menú/productos legibles;
- selección de ingredientes/extras;
- formularios sin quedar tapados por el teclado;
- checkout;
- aviso de privacidad y términos;
- flujo de pago;
- administrar pedido;
- descarga/visualización del comprobante;
- zoom del navegador;
- orientación vertical.

Cuando sea posible, repetir el flujo principal en iOS/Safari real o en un servicio de dispositivos reales.

### Personal / Admin

Probar:

- login;
- MFA;
- dashboard;
- pedidos;
- cocina;
- entrega;
- inventario;
- sábados/puntos de entrega;
- personal;
- ARCO;
- tablas sin contenido inaccesible;
- modales;
- navegación con teclado.

### Cámara / QR

En el dispositivo que realmente se usará durante la entrega:

- conceder permiso de cámara;
- abrir el scanner;
- escanear un QR real generado por un pedido de prueba;
- confirmar entrega;
- denegar permiso y comprobar un error entendible;
- repetir con poca luz si ese será un escenario operativo real.

### Viewports mínimos de revisión visual

Además del teléfono real, revisar manualmente:

```text
320x568
360x800
390x844
768x1024
1366x768
1920x1080
```

No deben existir:

- scroll horizontal accidental;
- botones fuera de pantalla;
- texto cortado;
- tablas imposibles de operar;
- overlays detrás de otros elementos;
- formularios ocultos por teclado;
- controles táctiles demasiado pequeños en flujos críticos.

## 5. Orden recomendado

Ejecutar en este orden:

```text
1. VPS definitivo
2. DNS
3. TLS
4. preflight
5. go-live-check
6. validate-public-endpoints.sh
7. benchmark Argon2id
8. smoke responsive/dispositivos reales
9. abrir tráfico controlado
10. recolectar RUM
11. evaluar Core Web Vitals p75
```

Core Web Vitals es el único bloque que necesariamente se cierra **después de comenzar a recibir tráfico real**.

## 6. Estado del hallazgo

Mientras no exista VPS/dominio/tráfico reales:

```text
Validación en infraestructura real: 🟡 PENDIENTE
```

No es un defecto del código actual. Es un gate operacional pendiente.

El control solo cambia a ✅ cuando existe evidencia de los cuatro bloques:

- TLS/HTTPS;
- Argon2id;
- Core Web Vitals;
- responsive/cámara final.
