# Runbook — Cuenta de staff/Admin comprometida

## Disparadores

Usar este runbook ante:

- login/Admin no reconocido;
- MFA restablecido sin autorización;
- cambio de contraseña/rol inesperado;
- acciones administrativas no reconocidas;
- cookie/JWT de staff robado o sospechoso.

## Contención inmediata

1. identificar la cuenta afectada y declarar SEV-1 si es ADMIN;
2. desde una cuenta ADMIN confiable, desactivar la cuenta comprometida en **Personal** cuando sea necesario;
3. restablecer su contraseña a un valor nuevo y único;
4. para ADMIN, restablecer MFA desde **otro Admin confiable** y exigir enrolamiento nuevo;
5. si hay duda sobre integridad de pagos, poner `ENABLE_REAL_PAYMENTS=false`;
6. no reutilizar recovery codes anteriores.

El cambio de contraseña invalida las sesiones existentes porque las sesiones se validan contra la versión de credencial vigente. Desactivar la cuenta también impide el uso normal de esa identidad.

## Investigación

Revisar AuditLog y logs alrededor de la ventana sospechosa:

- login fallido/bloqueado;
- MFA requerido/reset;
- login exitoso;
- cambios de usuarios/roles;
- cambios de inventario/eventos;
- pagos, reembolsos y pedidos modificados;
- solicitudes ARCO;
- timestamps/request IDs relacionados.

Determinar:

- primera actividad no autorizada conocida;
- última actividad no autorizada conocida;
- IP/UA disponibles en logs HTTP;
- acciones administrativas efectuadas;
- si se expusieron o modificaron datos de clientes.

## Recuperación

1. confirmar que la cuenta vuelve a estar bajo control del titular;
2. verificar contraseña nueva y, para ADMIN, MFA nuevo;
3. comprobar que no existan cuentas staff desconocidas;
4. revisar roles y estado activo de todo el personal;
5. reconciliar pedidos/pagos afectados;
6. confirmar health/readiness y ausencia de nuevos eventos sospechosos.

## Escalamiento especial

Si **no queda ningún Admin confiable**, no intentar recuperación desde un navegador comprometido. Restringir temporalmente el panel administrativo y realizar recuperación controlada desde el acceso operativo del VPS/DB, preservando antes evidencia y registrando cada cambio.

## Cierre

No cerrar hasta confirmar:

- identidad recuperada;
- sesiones antiguas inutilizables;
- MFA renovado cuando aplica;
- cambios maliciosos revertidos o reconciliados;
- alcance de datos evaluado;
- causa probable documentada.
