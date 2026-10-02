# Runbook — DDoS, abuso o caída operativa

## Disparadores

- Web/API inaccesibles;
- pico anormal de 429/5xx;
- CPU/RAM/disco saturados;
- tráfico automatizado sostenido;
- latencia p95 fuera de rango;
- Nginx/API reiniciándose;
- proveedor reporta ataque o degradación.

## Triage inicial

Separar primero:

1. ataque/abuso de tráfico;
2. fallo de aplicación;
3. fallo DB/Redis;
4. falta de CPU/RAM/disco;
5. problema DNS/TLS/Nginx;
6. caída del proveedor/VPS.

Revisar Prometheus/Grafana cuando estén operativos y logs de Nginx/API.

## Contención

- mantener PostgreSQL y Redis sin exposición pública;
- no abrir puertos 3000/4000 como “solución temporal”;
- conservar rate limiting activo;
- bloquear patrones/IPs solo si existe evidencia suficiente y sin depender de una lista manual como defensa principal;
- si pagos no pueden operar de forma segura, poner `ENABLE_REAL_PAYMENTS=false`;
- ante saturación severa, priorizar disponibilidad de health, consulta de pedidos ya pagados y funciones operativas esenciales.

Si se usa un WAF/CDN/edge provider en el futuro, activar sus controles de mitigación siguiendo la configuración del proveedor.

## Diagnóstico

Comprobar:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  ps
```

Health:

```bash
curl -fsS -H 'X-Forwarded-Proto: https' \
  http://127.0.0.1:4000/api/v1/health/live

curl -fsS -H 'X-Forwarded-Proto: https' \
  http://127.0.0.1:4000/api/v1/health/ready
```

También revisar:

- uso de CPU/RAM/disco;
- reinicios de contenedores;
- conexiones DB;
- 429/5xx;
- latencia;
- errores de DNS/TLS;
- espacio de logs/backups.

## Recuperación

- corregir la causa antes de reiniciar repetidamente;
- reiniciar solo el servicio afectado cuando sea apropiado;
- si el VPS está perdido, usar `deploy/DR.md`;
- verificar consistencia de pedidos/pagos después de una caída;
- confirmar que jobs/timers vuelven a ejecutarse;
- confirmar backup reciente y offsite cuando esté habilitado.

## Validación

Antes de declarar estable:

- Web y API responden;
- readiness está verde;
- tasas 5xx/429 regresan a valores normales;
- DB y Redis permanecen privados;
- no existe backlog crítico de pagos/webhooks/correos;
- pedidos creados antes/durante la caída fueron reconciliados.

## Cierre

Registrar duración, causa, tráfico/recursos observados, impacto en pedidos/pagos, medidas temporales y cambios permanentes de capacidad/rate limit/edge.
