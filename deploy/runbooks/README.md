# Runbooks de incidentes — Burger Danlin

Fecha de revisión: **1 de octubre de 2026**

Estos runbooks cubren la respuesta inicial a incidentes de seguridad y disponibilidad del MVP. No sustituyen asesoría legal, fiscal, de privacidad ni del proveedor de infraestructura.

## Objetivos

1. contener el incidente sin destruir evidencia;
2. proteger clientes, pedidos y pagos;
3. recuperar el servicio desde un estado confiable;
4. documentar decisiones, alcance y tiempos;
5. evitar que una respuesta improvisada agrave el incidente.

## Severidad

| Nivel | Criterio |
| --- | --- |
| SEV-1 | compromiso confirmado o probable de Admin, DB, secretos críticos, pagos, backup key o indisponibilidad total sostenida |
| SEV-2 | degradación importante, dependencia vulnerable explotable, abuso activo contenido o exposición limitada |
| SEV-3 | alerta sin compromiso confirmado, intento bloqueado o incidente menor sin impacto material |

Ante duda entre dos niveles, usar temporalmente el nivel más alto hasta conocer el alcance.

## Roles mínimos

Antes de producción se deben asignar personas reales fuera del repositorio:

- Incident Lead: coordina decisiones y línea de tiempo.
- Technical Lead: contención, recuperación y validación técnica.
- Business/Privacy Contact: clientes, privacidad, proveedor de pagos y obligaciones externas.

Los nombres, teléfonos y canales privados no deben almacenarse en Git. Mantener una copia protegida y accesible aunque el VPS esté caído.

## Primeros 15 minutos

1. registrar hora de detección, fuente de alerta y síntomas;
2. declarar severidad provisional;
3. no borrar logs, contenedores, volúmenes ni cuentas antes de preservar evidencia;
4. limitar el acceso o tráfico afectado;
5. si existe riesgo para pagos reales, poner `ENABLE_REAL_PAYMENTS=false`;
6. conservar request IDs, timestamps, IDs de usuario/pedido/evento y acciones de AuditLog relevantes;
7. abrir una línea de tiempo del incidente sin copiar secretos ni PII innecesaria.

## Evidencia mínima

Conservar, cuando aplique:

- hora de inicio/detección/contención/recuperación;
- commit/deploy activo;
- request IDs;
- AuditLog relacionado;
- logs de API/Web/Nginx/PostgreSQL/host;
- alertas de Prometheus/Grafana/hosting;
- cambios de firewall/DNS/secrets;
- checksums y referencia del backup usado;
- acciones tomadas y quién las aprobó.

Nunca pegar en tickets o chats:

- contraseñas;
- JWT/cookies;
- `DATABASE_URL` completa;
- `AUTH_JWT_SECRET`;
- `MFA_ENCRYPTION_KEY`;
- `QR_TOKEN_SECRET`;
- tokens de Mercado Pago;
- claves S3;
- clave privada `age`.

## Logs operativos

Desde el VPS:

```bash
cd /opt/burger-danlin

docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  logs --since=30m api web postgres redis
```

Timers:

```bash
journalctl -u burger-danlin-backup.service --since "30 minutes ago"
journalctl -u burger-danlin-restore-drill.service --since "30 minutes ago"
journalctl -u burger-danlin-retention-cleanup.service --since "30 minutes ago"
```

Ajustar la ventana sin destruir ni truncar logs originales.

## Runbooks

- [Cuenta de staff/Admin comprometida](account-takeover.md)
- [Filtración de secretos](secret-leak.md)
- [Exposición o compromiso de PostgreSQL](database-exposure.md)
- [Dependencia o supply chain comprometida](dependency-compromise.md)
- [DDoS, abuso o caída operativa](ddos-outage.md)

Para pérdida total del VPS, usar además `deploy/DR.md`.

## Criterio de recuperación

No declarar recuperado hasta que:

- la causa inmediata esté contenida;
- credenciales comprometidas estén rotadas cuando corresponda;
- sesiones/tokens afectados ya no sean válidos;
- health/readiness estén correctos;
- pedidos/pagos críticos sean consistentes;
- logs/alertas no indiquen actividad anómala nueva;
- exista evidencia del estado final.

## Cierre y postmortem

Dentro del registro del incidente documentar:

- impacto real;
- causa raíz o causa más probable;
- ventana de exposición;
- datos/sistemas afectados;
- acciones de contención;
- acciones permanentes;
- controles que funcionaron;
- controles que fallaron;
- tareas con responsable y fecha objetivo.

Si existe posible exposición de datos personales o financieros, el Business/Privacy Contact debe evaluar las obligaciones de notificación aplicables antes de comunicar conclusiones al cliente.
