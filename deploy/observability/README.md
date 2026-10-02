# Observabilidad — Burger Danlin

Fecha: 2026-09-27

## Stack

Burger Danlin usa una pila autocontenida para el VPS:

- Grafana 13.2.2: dashboards y exploración.
- Prometheus 3.15.0: métricas y reglas de alerta.
- Loki 3.7.8: almacenamiento de logs.
- Grafana Alloy 1.20.0: recolección de logs de Docker y collector OTLP.
- Grafana Tempo 2.10.8: almacenamiento y consulta de trazas.
- Node Exporter 1.12.1: métricas del host Linux.

Promtail no se usa porque alcanzó End-of-Life en 2026. Alloy es el recolector soportado.

## Qué se observa

### API

El endpoint interno:

```text
/api/v1/metrics
```

expone:

- requests HTTP por método, ruta y status;
- histogramas de latencia;
- memoria RSS y heap de Node;
- uptime del proceso;
- disponibilidad de PostgreSQL;
- latencia de ping a PostgreSQL;
- pedidos por estado;
- pagos por estado;
- stock y umbral de inventario.

Las rutas dinámicas se normalizan antes de usarse como labels para evitar cardinalidad alta.

### VPS

Node Exporter expone:

- CPU;
- memoria;
- filesystem;
- load;
- red;
- métricas estándar del kernel/host.

### Logs

Alloy lee en modo read-only:

```text
/var/lib/docker/containers/*/*-json.log
```

y los envía a Loki.

No se monta `/var/run/docker.sock`, reduciendo el privilegio del recolector.

Loki conserva logs durante 30 días.

### Distributed tracing

El API puede emitir trazas OTLP compatibles con OpenTelemetry cuando:

```text
OTEL_TRACING_ENABLED=true
```

Flujo:

```text
API -> OTLP/HTTP -> Alloy -> OTLP/gRPC -> Tempo -> Grafana
```

Se generan spans de:

- requests HTTP entrantes;
- requests HTTP salientes iniciados dentro de una request trazada.

Cada request trazada agrega `traceId` al log HTTP y devuelve `X-Trace-Id` para facilitar soporte/correlación.

Por privacidad, los spans no incluyen bodies, cookies, nombres, teléfonos, correos ni query strings. Los `traceparent` solo se propagan a hosts declarados explícitamente en `OTEL_PROPAGATE_HOSTS`; proveedores externos no reciben ese header por defecto.

Tempo usa almacenamiento local con retención inicial de 72 horas. Para el MVP pequeño sirve como baseline operativo; no sustituye el backup de PostgreSQL.

### Prometheus

Prometheus conserva métricas durante 15 días y evalúa reglas cada 15 segundos.

Targets:

- Burger Danlin API;
- Node Exporter;
- Loki;
- Alloy;
- Prometheus.

## Alertas preparadas

`deploy/observability/prometheus/alerts.yml` incluye:

- API caída por más de 2 minutos;
- PostgreSQL no disponible;
- tasa 5xx superior a 5%;
- p95 superior a 1 segundo;
- inventario por debajo del umbral;
- memoria del VPS superior a 90%;
- menos de 15% libre en el filesystem raíz.

Estas reglas se evalúan en Prometheus. Para enviar notificaciones externas todavía se debe agregar Alertmanager o configurar un mecanismo de notificación equivalente.

## Levantar la pila

En producción:

```bash
cd /opt/burger-danlin

docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile observability \
  up -d prometheus loki tempo alloy node-exporter grafana
```

Verifica:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile observability \
  ps
```

## Acceso seguro a Grafana

Grafana no se publica en una interfaz externa.

Binding:

```text
127.0.0.1:3001
```

Desde otra computadora usa un túnel SSH:

```bash
ssh -L 3001:127.0.0.1:3001 deploy@TU_VPS
```

Después abre localmente:

```text
http://127.0.0.1:3001
```

La contraseña se define fuera del repositorio:

```text
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<secreto-largo>
```

## Datasources

Grafana se aprovisiona automáticamente con:

- Prometheus: `http://prometheus:9090`
- Loki: `http://loki:3100`
- Tempo: `http://tempo:3200`

No es necesario crearlos manualmente.

## Dashboard

Se instala automáticamente:

```text
Burger Danlin — Overview
```

Incluye:

- API up;
- DB up;
- requests/s;
- p95;
- memoria del host;
- disco del host;
- requests por status;
- p50/p95/p99;
- pedidos por estado;
- inventario;
- logs Docker desde Loki.

## Seguridad

- Prometheus no publica puerto al host.
- Loki no publica puerto al host.
- Tempo no publica puertos al host.
- Alloy no publica puertos al host; el receptor OTLP solo está disponible por la red Docker `app`.
- Node Exporter no publica puerto al host.
- Grafana publica únicamente en loopback.
- Nginx bloquea `/api/v1/metrics` públicamente.
- Alloy lee archivos de logs en read-only.
- No se monta Docker socket.
- Los servicios usan `no-new-privileges` y capabilities eliminadas cuando aplica.
- Los datos persistentes viven en volúmenes Docker separados.

## Persistencia

Volúmenes:

- `burger_prometheus_data`
- `burger_loki_data`
- `burger_tempo_data`
- `burger_alloy_data`
- `burger_grafana_data`

Estos datos de observabilidad son operativos y no sustituyen los backups de PostgreSQL.

## Validaciones antes de producción

1. Generar un password fuerte para Grafana.
2. Levantar la pila.
3. Confirmar que Prometheus muestra todos los targets como UP.
4. Confirmar que Grafana ve Prometheus, Loki y Tempo.
5. Cambiar `OTEL_TRACING_ENABLED=true` y reiniciar API después de levantar observabilidad.
6. Generar tráfico de prueba y confirmar trazas de `burger-danlin-api` en Tempo.
7. Tomar un `X-Trace-Id` de una respuesta y correlacionarlo con el log HTTP y la traza.
8. Generar un log controlado y comprobar que aparece en Loki.
9. Confirmar que `https://api.example.com/api/v1/metrics` devuelve 404.
10. Revisar consumo real de RAM/CPU/disco del stack, incluyendo Tempo.
11. Definir canal de notificaciones y agregar Alertmanager si se requieren avisos externos.

## Estado de tracing

La ruta de tracing ya está implementada y es opt-in.

Queda pendiente únicamente validarla sobre el VPS real, medir el consumo de Tempo y ajustar `OTEL_TRACE_SAMPLE_RATIO` si el volumen de tráfico crece.
