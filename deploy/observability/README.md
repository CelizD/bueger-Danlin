# Observabilidad — Burger Danlin

Fecha: 2026-09-27

## Stack

Burger Danlin usa una pila autocontenida para el VPS:

- Grafana 13.2.2: dashboards y exploración.
- Prometheus 3.15.0: métricas y reglas de alerta.
- Loki 3.7.8: almacenamiento de logs.
- Grafana Alloy 1.20.0: recolección de logs de Docker.
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
  up -d prometheus loki alloy node-exporter grafana
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
- Alloy no publica puerto al host.
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
- `burger_alloy_data`
- `burger_grafana_data`

Estos datos de observabilidad son operativos y no sustituyen los backups de PostgreSQL.

## Validaciones antes de producción

1. Generar un password fuerte para Grafana.
2. Levantar la pila.
3. Confirmar que Prometheus muestra todos los targets como UP.
4. Confirmar que Grafana ve Prometheus y Loki.
5. Generar tráfico de prueba y revisar requests/latencia.
6. Generar un log controlado y comprobar que aparece en Loki.
7. Confirmar que `https://api.example.com/api/v1/metrics` devuelve 404.
8. Revisar consumo real de RAM/CPU en el VPS.
9. Definir canal de notificaciones y agregar Alertmanager si se requieren avisos externos.

## Pendiente

El stack actual cubre métricas, logs, dashboards y reglas de alerta.

Distributed tracing todavía no está implementado. Si se necesita después, la ruta natural es OpenTelemetry + Tempo usando Alloy como collector.
