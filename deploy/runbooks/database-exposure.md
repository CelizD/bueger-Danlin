# Runbook — Exposición o compromiso de PostgreSQL

## Disparadores

- puerto 5432 accesible desde Internet;
- credenciales DB filtradas;
- consultas/cambios no reconocidos;
- alteración o borrado de datos;
- indicios de acceso al volumen o backup sin autorización.

## Contención inmediata

1. declarar SEV-1;
2. bloquear exposición de red antes de hacer cambios destructivos;
3. confirmar firewall y que PostgreSQL no tenga binding público;
4. si la integridad de pedidos/pagos está en duda, poner `ENABLE_REAL_PAYMENTS=false`;
5. preservar logs y estado antes de restaurar o borrar nada;
6. rotar la credencial afectada una vez preservada la evidencia necesaria.

En la topología prevista PostgreSQL debe existir solo en la red Docker `data`, sin puerto publicado al host.

## Determinar alcance

Revisar:

- periodo en que 5432 pudo estar accesible;
- usuario/credencial afectada: admin o runtime;
- logs PostgreSQL;
- cambios de esquema;
- usuarios/roles DB;
- tablas de usuarios, pedidos, pagos, AuditLog y sesiones;
- backups locales/offsite;
- volumen del host;
- cambios inesperados en migraciones.

## Integridad

No restaurar automáticamente solo porque exista una anomalía.

Comparar primero:

- estado actual;
- último backup confiable;
- eventos de negocio válidos ocurridos después del backup;
- posibilidad de reconciliar pagos/pedidos sin perder transacciones legítimas.

Si se requiere restore, seguir `deploy/DR.md` y conservar antes una copia/evidencia del estado comprometido.

## Recuperación

1. cerrar la exposición de red;
2. rotar credenciales DB afectadas;
3. reconstruir permisos de mínimo privilegio si fueron alterados;
4. ejecutar migraciones solo desde código/commit confiable;
5. restaurar o corregir datos según evidencia;
6. reconciliar pagos con el proveedor;
7. validar health/readiness;
8. ejecutar smoke test de pedido y Admin;
9. confirmar backup nuevo y restore drill.

## Privacidad

Si existe posibilidad de lectura de PII, determinar:

- tablas/campos accesibles;
- ventana de exposición;
- evidencia de extracción o ausencia de evidencia;
- obligación aplicable de notificación.

No afirmar que “no hubo acceso” únicamente porque no aparezca un error en logs.

## Cierre

Cerrar solo cuando red, credenciales, permisos, integridad de datos, backups y alcance de privacidad hayan sido revisados y documentados.
