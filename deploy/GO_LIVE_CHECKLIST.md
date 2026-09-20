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

- [ ] Elegir Stripe o Mercado Pago para lanzamiento.
- [ ] Configurar credenciales reales.
- [ ] Configurar endpoint webhook real.
- [ ] Validar firmas.
- [ ] Probar pago real en entorno permitido por el proveedor.
- [ ] Probar reintentos/idempotencia.
- [ ] Probar pago fallido.
- [ ] Probar cancelación/refund según política.
- [ ] Desactivar mock antes de go-live.

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

### Operación

- [ ] Instalar/activar timers systemd.
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
