# Runbook — Filtración de secretos

## Disparadores

Usar ante un secreto visto en:

- commit/PR;
- log;
- captura de pantalla;
- chat/ticket;
- archivo público;
- imagen Docker;
- equipo o VPS comprometido.

## Regla principal

**Rotar primero, investigar después.** Borrar el texto visible no vuelve seguro un secreto ya expuesto.

## Clasificación

Tratar como críticos, entre otros:

- `AUTH_JWT_SECRET`;
- `MFA_ENCRYPTION_KEY`;
- `QR_TOKEN_SECRET`;
- credenciales PostgreSQL;
- `REDIS_PASSWORD`;
- `MERCADOPAGO_ACCESS_TOKEN`;
- `MERCADOPAGO_WEBHOOK_SECRET`;
- credenciales S3;
- token Telegram;
- `backup-age.key`.

## Contención

1. identificar exactamente qué secreto se expuso y desde cuándo;
2. revocarlo/rotarlo en su sistema de origen;
3. actualizar `/etc/burger-danlin/production.env` o el archivo root-only correspondiente;
4. reiniciar únicamente los servicios que consumen el secreto rotado;
5. si el secreto podría permitir pagos, acceso Admin o DB, tratar como SEV-1;
6. si fue un token de pagos, mantener `ENABLE_REAL_PAYMENTS=false` hasta validar la rotación.

## Consideraciones por secreto

### AUTH_JWT_SECRET

- generar un secreto distinto;
- actualizar producción;
- reiniciar API;
- asumir que todas las sesiones firmadas anteriores dejan de ser confiables y exigir nuevo login.

### MFA_ENCRYPTION_KEY

La rotación afecta la capacidad de descifrar secretos TOTP existentes. No rotarla de forma improvisada: preparar re-enrolamiento de Admins y preservar evidencia. Si la clave se considera comprometida, priorizar contención del acceso administrativo y planificar la migración/re-enrolamiento.

### Credenciales PostgreSQL

- rotar admin y/o runtime según la credencial afectada;
- actualizar producción;
- volver a ejecutar/verificar el bootstrap si corresponde;
- confirmar que PostgreSQL sigue sin exposición pública;
- revisar logs por accesos y cambios inesperados.

### Mercado Pago

- revocar/rotar en el proveedor;
- actualizar configuración;
- mantener pagos reales apagados;
- volver a probar autenticación, webhook, reconciliación y refund antes de reactivar.

### S3/offsite

- revocar la clave;
- emitir credenciales de mínimo privilegio nuevas;
- revisar accesos al bucket y Versioning/Object Lock;
- verificar integridad de backups.

### backup-age.key

Considerar potencialmente comprometido todo backup cifrado con el recipient asociado que haya quedado accesible al atacante. Crear una identidad nueva para backups futuros y evaluar el alcance de copias históricas.

## Investigación

- ejecutar/revisar Gitleaks sobre historial;
- identificar primer commit/log/artefacto donde apareció;
- revisar accesos del proveedor asociado;
- revisar AuditLog y logs operativos;
- comprobar que no existan copias adicionales del secreto.

No reescribir historial de Git como sustituto de la rotación. Si se limpia el historial, hacerlo solo después de revocar el secreto y coordinando el impacto en clones/branches.

## Validación

- el secreto antiguo debe fallar;
- el secreto nuevo debe funcionar solo donde corresponde;
- CI/Security deben quedar verdes;
- health/readiness deben pasar;
- no debe quedar el valor nuevo en logs o Git.

## Cierre

Registrar secreto afectado por **nombre**, nunca por valor, ventana de exposición, sistemas accesibles, evidencia de revocación y cualquier acción adicional de privacidad/negocio.
