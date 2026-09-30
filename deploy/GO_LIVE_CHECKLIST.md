# Go-live checklist — Burger Danlin

Este checklist separa lo que puede prepararse ahora de lo que solo puede verificarse cuando exista infraestructura real.

## Ya preparado en el repositorio

- [x] Dockerfiles multi-stage para API y Web.
- [x] Procesos Node non-root.
- [x] PostgreSQL y Redis sin puertos públicos en Compose de producción.
- [x] Redis con contraseña.
- [x] PostgreSQL con SCRAM-SHA-256.
- [x] Health/readiness endpoints.
- [x] Prisma migrate deploy.
- [x] Nginx reverse proxy versionado.
- [x] HTTPS obligatorio en API de producción.
- [x] Secretos fuera de Git.
- [x] Backup PostgreSQL cifrado con age.
- [x] SHA-256 del backup.
- [x] Restore drill aislado.
- [x] Timer systemd de backup.
- [x] Integración offsite S3-compatible preparada.
- [x] Verificación de Versioning + Object Lock + retención.
- [x] Descarga de recuperación desde offsite.
- [x] VPS preflight script.
- [x] Go-live environment gate.
- [x] Objetivos técnicos iniciales RPO/RTO documentados.
- [x] Retention cleanup con dry-run, kill switch y tests.
- [x] Timer systemd diario de retención preparado.
- [x] Prometheus/Loki/Grafana/Alloy configurados.
- [x] Dashboard Grafana y datasources provisionados.
- [x] Reglas Prometheus para API, DB, latencia, errores, inventario, memoria y disco.
- [x] Endpoint de métricas bloqueado desde Nginx público.

## Pendiente hasta tener VPS/dominio/proveedores

### Infraestructura

- [ ] Contratar VPS.
- [ ] Crear usuario de deploy no-root.
- [ ] SSH solo con claves.
- [ ] Deshabilitar login SSH de root.
- [ ] Firewall: publicar únicamente SSH, 80 y 443.
- [ ] Instalar Docker Engine + Compose plugin.
- [ ] Instalar Nginx.
- [ ] Copiar repositorio a /opt/burger-danlin.
- [ ] Crear /etc/burger-danlin/production.env con modo 600.
- [ ] Crear /var/backups/burger-danlin.

### Dominio y TLS

- [ ] Configurar dominio real de Web.
- [ ] Configurar dominio real de API.
- [ ] Crear DNS A/AAAA hacia el VPS.
- [ ] Sustituir dominios example.com en Nginx.
- [ ] Emitir certificados TLS.
- [ ] Probar renovación automática.
- [ ] Validar HTTPS desde una red externa.
- [ ] Confirmar que 3000/4000/5432/6379 no estén públicos.

### Pagos

- [x] Proveedor del MVP definido: Mercado Pago.
- [ ] Configurar credenciales reales.
- [ ] Configurar en Mercado Pago el endpoint HTTPS `/api/v1/payments/webhooks/mercadopago`.
- [x] Validación HMAC + ventana anti-replay implementada en código.
- [x] Deduplicación persistente + recuperación de PROCESSING abandonado implementadas.
- [x] Reconciliación canónica contra `GET /v1/orders/{id}` implementada.
- [x] Refund total idempotente de Mercado Pago implementado en código.
- [ ] Probar pago real en entorno permitido por el proveedor.
- [ ] Probar reintentos/idempotencia con credenciales sandbox.
- [ ] Probar pago fallido.
- [ ] Probar cancelación/refund según política.
- [ ] Cambiar `ENABLE_REAL_PAYMENTS=true` únicamente después de las pruebas sandbox/reales.
- [x] El gate de go-live bloquea `mock`, Stripe no implementado y `ENABLE_REAL_PAYMENTS=false`.

### Backup offsite

- [ ] Crear bucket privado independiente del VPS.
- [ ] Habilitar Versioning.
- [ ] Habilitar Object Lock.
- [ ] Definir retención por defecto.
- [ ] Crear credenciales de mínimo privilegio.
- [ ] Guardarlas solo en production.env.
- [ ] Cambiar OFFSITE_BACKUP_ENABLED=true.
- [ ] Ejecutar upload real.
- [ ] Descargar el backup desde offsite.
- [ ] Validar SHA-256.
- [ ] Ejecutar restore drill con el archivo descargado.
- [ ] Guardar una segunda copia segura de backup-age.key fuera del VPS.

### Observabilidad

- [ ] Generar contraseña fuerte de Grafana.
- [ ] Levantar el perfil `observability`.
- [ ] Confirmar targets de Prometheus en estado UP.
- [ ] Confirmar ingestión de logs en Loki.
- [ ] Confirmar dashboard `Burger Danlin — Overview`.
- [ ] Confirmar que Grafana solo escucha en loopback o detrás de acceso restringido.
- [ ] Confirmar que `/api/v1/metrics` no es público.
- [ ] Definir canal de notificaciones y conectar Alertmanager o equivalente.
- [ ] Medir consumo real de CPU/RAM/disco del stack.

### Operación

- [ ] Validar plazos legales/fiscales de retención.
- [ ] Ejecutar retention cleanup en dry-run y revisar candidatos.
- [ ] Cambiar RETENTION_CLEANUP_ENABLED=true solo después de esa revisión.
- [ ] Ejecutar una aplicación manual controlada y revisar el resultado.
- [ ] Instalar/activar timers systemd.
- [ ] Confirmar primera ejecución del timer de retención.
- [ ] Confirmar primer backup horario.
- [ ] Confirmar primer restore drill.
- [ ] Configurar alertas de fallo de backups/timers.
- [ ] Configurar monitoreo externo de Web/API.
- [ ] Verificar logs y rotación.
- [ ] Definir responsable de incidentes.
- [ ] Ejecutar simulacro de pérdida total del VPS.
- [ ] Medir RPO observado.
- [ ] Medir RTO observado.
- [ ] Confirmar RPO <= 1h o ajustar objetivo.
- [ ] Confirmar RTO <= 4h o ajustar objetivo.

## Validación antes de abrir tráfico

En el VPS:

```bash
cd /opt/burger-danlin

sudo COMPOSE_FILE=/opt/burger-danlin/docker-compose.prod.yml \
  ENV_FILE=/etc/burger-danlin/production.env \
  sh deploy/vps/preflight.sh

sudo ENV_FILE=/etc/burger-danlin/production.env \
  sh deploy/vps/go-live-check.sh
```

Ambos deben terminar sin FAIL.

Después:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  ps
```

PostgreSQL y Redis no deben mostrar bindings públicos.

## Regla de lanzamiento

No abrir tráfico público hasta que:

1. preflight pase;
2. go-live-check pase;
3. migraciones pasen;
4. API/Web estén healthy;
5. TLS real esté activo;
6. el proveedor de pagos real esté validado;
7. exista backup local y offsite;
8. un backup recuperado desde offsite haya pasado restore drill.


## Aviso de privacidad
- [ ] `PRIVACY_RESPONSIBLE` contiene la identidad legal real del responsable.
- [ ] `PRIVACY_ADDRESS` contiene un domicilio de contacto válido.
- [ ] `PRIVACY_EMAIL` es un correo atendido para privacidad, limitación de uso y derechos ARCO.
- [ ] Abrir `/privacidad` en producción y verificar el aviso integral.
- [ ] Confirmar que el checkout muestra el aviso simplificado antes de enviar nombre/teléfono/correo.


## Términos, cancelación y reembolso
- [ ] Abrir `/terminos` en producción y revisar identidad, domicilio y correo de contacto.
- [ ] Confirmar que el checkout no permite continuar sin aceptar los Términos y Condiciones.
- [ ] Confirmar que la condición de entrega grupal requiere una aceptación separada.
- [ ] Probar cancelación de pedido no pagado antes del corte.
- [ ] Probar cancelación de pedido pagado antes del corte y reembolso.
- [ ] Probar pago tardío después de expirar la reserva y verificar que no reactive el pedido.


## Datos públicos del vendedor
- [ ] `BUSINESS_LEGAL_NAME` contiene el nombre o razón social real del proveedor.
- [ ] `BUSINESS_TRADE_NAME` contiene el nombre comercial visible.
- [ ] `BUSINESS_RFC` contiene el RFC real del proveedor.
- [ ] `BUSINESS_ADDRESS` contiene un domicilio físico real para aclaraciones/reclamaciones.
- [ ] `SUPPORT_PHONE` es un número atendido.
- [ ] `SUPPORT_EMAIL` es un correo atendido.
- [ ] Verificar los datos en checkout, footer, `/terminos` y `/pedido/:orderCode`.
