# Gestión de secretos en producción

Burger Danlin separa la **configuración no sensible** de los **secretos de aplicación**.

El repositorio no contiene secretos reales. En producción, los secretos de la API se consumen mediante la convención:

```text
NOMBRE_DEL_SECRETO_FILE=/ruta/al/archivo
```

El valor del secreto se lee del archivo en tiempo de ejecución. Las variables directas siguen siendo compatibles para desarrollo y CI, pero el go-live exige archivos para los secretos de aplicación críticos.

## Estado

El código queda preparado para recibir secretos desde archivos materializados por un sistema externo.

Antes de producción real todavía se debe elegir y desplegar uno de estos backends:

- HashiCorp Vault;
- Secret Manager del proveedor de nube;
- archivos materializados mediante un flujo respaldado por KMS/HSM.

`SECRETS_BACKEND=unconfigured` bloquea el go-live.

Valores aceptados por el gate:

```text
vault
cloud-secret-manager
kms-backed-files
```

Esta variable declara la integración operativa; no sustituye la configuración real del proveedor.

## Secretos de aplicación por archivo

El Compose de producción monta únicamente los archivos que necesita cada servicio.

| Secreto | Variable de ruta del host | Uso |
| --- | --- | --- |
| URL PostgreSQL runtime | `DATABASE_URL_FILE` | API y workers |
| JWT de staff | `AUTH_JWT_SECRET_FILE` | API |
| QR/acceso de pedidos | `QR_TOKEN_SECRET_FILE` | API |
| Cifrado MFA | `MFA_ENCRYPTION_KEY_FILE` | API |
| Mercado Pago access token | `MERCADOPAGO_ACCESS_TOKEN_FILE` | API |
| Mercado Pago webhook secret | `MERCADOPAGO_WEBHOOK_SECRET_FILE` | API |
| Contraseña SMTP | `MAIL_PASSWORD_FILE` | API / worker de correo |
| Telegram bot token | `TELEGRAM_BOT_TOKEN_FILE` | API / settlement / alertas |
| Telegram chat ID | `TELEGRAM_CHAT_ID_FILE` | API / settlement / alertas |
| Identidad privada age | `BACKUP_AGE_IDENTITY_FILE` | restore |

El archivo `deploy/production.env.example` contiene rutas, no valores, para estos secretos.

## Requisitos de los archivos

Los archivos deben:

- existir fuera del repositorio;
- ser creados por el backend de secretos o por un proceso de provisioning autorizado;
- contener únicamente el valor del secreto, con salto de línea final opcional;
- no aparecer en logs;
- ser legibles solo por el servicio que los necesita;
- montarse read-only dentro del contenedor;
- rotarse desde el sistema de origen.

La imagen del API ejecuta como usuario `node` no-root. El mecanismo que materialice los archivos debe otorgar lectura al UID/GID usado por el contenedor sin hacerlos públicamente legibles.

No uses permisos `0644` para resolver problemas de lectura.

## Ejemplo conceptual con Vault/Secret Manager

El proveedor externo debe materializar:

```text
/etc/burger-danlin/app-secrets/database-url
/etc/burger-danlin/app-secrets/auth-jwt-secret
/etc/burger-danlin/app-secrets/qr-token-secret
/etc/burger-danlin/app-secrets/mfa-encryption-key
/etc/burger-danlin/app-secrets/mercadopago-access-token
/etc/burger-danlin/app-secrets/mercadopago-webhook-secret
/etc/burger-danlin/app-secrets/mail-password
```

Después `production.env` solo referencia esas rutas.

El flujo recomendado es:

```text
Secret Manager / Vault / KMS
            |
            v
  materialización temporal
            |
            v
 archivo con permisos mínimos
            |
            v
 Docker bind mount read-only
            |
            v
 API lee NOMBRE_FILE
```

## Rotación

Para rotar un secreto:

1. generar/rotar el valor en su sistema de origen;
2. actualizar el archivo materializado de forma atómica;
3. reiniciar únicamente los servicios que consumen ese secreto;
4. revocar el valor anterior;
5. validar health/readiness y el flujo afectado;
6. registrar el incidente o cambio sin registrar el valor.

Para JWT, QR, MFA, pagos y base de datos se debe revisar el impacto antes de rotar porque algunos valores invalidan sesiones, tokens o datos cifrados existentes.

## Qué no debe estar en production.env

En producción no deben almacenarse directamente estos valores:

```text
AUTH_JWT_SECRET
QR_TOKEN_SECRET
MFA_ENCRYPTION_KEY
DATABASE_URL
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
MAIL_PASSWORD
```

Se deben usar sus variantes `*_FILE`.

## Secretos de infraestructura aún pendientes

El Compose todavía utiliza algunas credenciales de infraestructura mediante variables, principalmente:

- contraseña administrativa/runtime de PostgreSQL para bootstrap/migración;
- contraseña de Redis;
- credenciales S3 para backup offsite;
- contraseña administrativa de Grafana.

Por eso el control de Secret Manager permanece **parcial** hasta desplegar el backend real y migrar también estas credenciales al mecanismo elegido.

No se debe marcar este control como completado únicamente porque existan archivos locales.

## KMS y cifrado

La clave privada `backup-age.key` ya está separada del repositorio y de `production.env`.

Para producción madura, las claves maestras o credenciales que permitan recuperar otros secretos deben estar protegidas por KMS/HSM, Vault transit/seal o mecanismo equivalente del proveedor.

El objetivo es que comprometer el archivo `production.env` no entregue directamente credenciales de aplicación.

## Verificación antes del go-live

`deploy/vps/go-live-check.sh` verifica que:

- `SECRETS_BACKEND` no esté sin configurar;
- JWT, QR y MFA estén respaldados por archivos;
- SMTP use archivo para la contraseña;
- Mercado Pago use archivos para sus secretos;
- los archivos referenciados existan;
- la API realizará la validación criptográfica/longitud al arrancar.

La integración externa real debe probarse en el VPS antes de abrir tráfico.
