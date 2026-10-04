# Política de seguridad

La seguridad de **Burger Danlin** es importante para nosotros. Si encuentras una vulnerabilidad o un posible problema de seguridad, agradecemos que lo reportes de manera responsable para poder investigarlo y corregirlo antes de hacerlo público.

## Versiones soportadas

Actualmente, únicamente la versión más reciente desplegada en producción recibe actualizaciones de seguridad.

| Versión | Soportada |
| --- | --- |
| Última versión de `main` | ✅ Sí |
| Versiones anteriores | ❌ No |

## Reportar una vulnerabilidad

**No publiques vulnerabilidades de seguridad mediante Issues, Pull Requests ni Discussions públicos de GitHub.**

Usa un canal privado:

1. **GitHub Private Vulnerability Reporting** (preferido): [Security → Advisories → Report a vulnerability](https://github.com/CelizD/bueger-Danlin/security/advisories/new).
2. Si el canal anterior no está disponible, contacta al mantenedor del repositorio por un canal privado previamente acordado. Se añadirá aquí un correo de seguridad dedicado cuando esté disponible.

### Incluye, cuando sea posible

- Descripción de la vulnerabilidad.
- Archivo, endpoint o componente afectado.
- Pasos para reproducir el problema.
- Prueba de concepto (PoC), si la tienes.
- Impacto potencial.
- Evidencia, capturas o registros relevantes, con datos sensibles censurados.
- Versión, commit o entorno donde se encontró.
- Posible solución, si tienes alguna recomendación.
- Tu nombre o alias si deseas recibir crédito.

## Información que NO debes incluir

No incluyas valores reales de ninguno de estos elementos, ni en canales públicos ni en el reporte privado. Censúralos o reemplázalos por ejemplos:

- Contraseñas.
- Tokens JWT.
- Cookies de sesión.
- API keys.
- Secretos de producción.
- Credenciales de base de datos.
- Claves privadas.
- Datos personales de clientes.
- Información completa de tarjetas o pagos.
- Variables de entorno (`.env`).
- Tokens de Mercado Pago, Telegram u otros proveedores.

Si una credencial real fue expuesta durante una investigación, notifícalo de inmediato para que pueda ser revocada y reemplazada.

## Qué puedes esperar de nosotros

| Etapa | Plazo objetivo |
| --- | --- |
| Acuse de recibo | Dentro de **72 horas** |
| Evaluación inicial y clasificación | Dentro de **7 días** |
| Actualizaciones de estado | Cada **14 días** como máximo |
| Corrección | Según severidad; las críticas tienen prioridad |

Estos plazos son orientativos y pueden variar según la complejidad del caso y la disponibilidad del equipo. Si no recibes respuesta en el plazo de acuse, vuelve a contactar por otro canal privado disponible.

## Vulnerabilidades de especial interés

Agradecemos especialmente los reportes relacionados con:

- Bypass de autenticación.
- Escalamiento de privilegios.
- Acceso no autorizado al panel administrativo.
- Robo o reutilización de sesiones.
- Manipulación de JWT.
- IDOR / Broken Access Control.
- Inyección SQL.
- Cross-Site Scripting (XSS).
- Cross-Site Request Forgery (CSRF).
- Server-Side Request Forgery (SSRF).
- Ejecución remota de código.
- Path Traversal.
- Exposición de secretos.
- Filtración de datos personales.
- Manipulación de pedidos.
- Alteración del precio de productos.
- Manipulación del inventario.
- Alteración del estado de pagos.
- Bypass de validaciones de checkout.
- Reutilización o abuso de `Idempotency-Key`.
- Condiciones de carrera relacionadas con pedidos, inventario o pagos.
- Acceso indebido a comprobantes de compra.
- Abuso de endpoints administrativos.
- Rate limiting insuficiente que pueda provocar abuso real.
- Vulnerabilidades en dependencias utilizadas por el proyecto.

## Investigación responsable

Al investigar una posible vulnerabilidad:

- No accedas a información de otros usuarios.
- No modifiques ni elimines información real.
- No interrumpas deliberadamente el servicio.
- No realices ataques de denegación de servicio (DoS/DDoS).
- No ejecutes pruebas destructivas contra producción.
- No utilices ingeniería social contra usuarios o administradores.
- No intentes obtener persistencia dentro de los servidores.
- No descargues grandes cantidades de datos.
- Detén las pruebas si accidentalmente accedes a información sensible y avísanos.

Siempre que sea posible, realiza las pruebas en un entorno local o de desarrollo.

## Puerto seguro (Safe Harbor)

Consideramos que la investigación realizada de buena fe y conforme a esta política está autorizada. No emprenderemos acciones legales contra quienes:

- Reporten vulnerabilidades de forma privada y responsable.
- No accedan, modifiquen ni eliminen datos ajenos.
- No interrumpan ni degraden el servicio.
- Respeten las reglas de la sección *Investigación responsable*.

Si tienes dudas sobre si una actividad está permitida, contáctanos antes de realizarla.

## Alcance

Esta política aplica al código y servicios de **Burger Danlin**, incluyendo:

- Frontend público.
- Panel administrativo.
- Backend/API.
- Sistema de autenticación y gestión de sesiones.
- Sistema de pedidos, inventario y puntos de entrega.
- Flujo de checkout e integración de pagos.
- Notificaciones.
- Base de datos.
- Infraestructura y configuración desarrolladas específicamente para el proyecto.

### Fuera de alcance

- Ataques de denegación de servicio (DoS/DDoS).
- Ingeniería social, phishing o acceso físico.
- Pruebas contra cuentas o datos de terceros sin autorización.
- Hallazgos de escáneres automáticos sin demostración de impacto real.
- Spam o contenido no relacionado con seguridad.

## Vulnerabilidades de terceros

Si el problema pertenece exclusivamente a una dependencia externa, framework, proveedor de pagos, servicio de infraestructura u otro tercero, repórtalo también al proveedor correspondiente, por ejemplo: Node.js, NestJS, Next.js, PostgreSQL, Prisma, Redis, Mercado Pago o GitHub.

Aun así, puedes notificarnos si la vulnerabilidad representa un riesgo para Burger Danlin.

## Proceso después de recibir un reporte

1. Se revisa y valida la vulnerabilidad.
2. Se determina su severidad e impacto.
3. Se identifica la causa raíz.
4. Se prepara una corrección.
5. Se agregan pruebas para evitar regresiones cuando corresponda.
6. Se despliega la corrección.
7. Se rotan credenciales o sesiones si existe posibilidad de exposición.
8. Se documenta el incidente cuando sea necesario.

Las vulnerabilidades críticas tienen prioridad sobre cambios funcionales normales.

## Divulgación coordinada

Seguimos un modelo de divulgación coordinada. Te pedimos que no publiques detalles técnicos de la vulnerabilidad hasta que exista una corrección desplegada o se haya acordado una fecha de divulgación. Si no hay acuerdo, consideramos razonable un plazo de **90 días** desde el reporte.

Con tu permiso, daremos crédito público en el aviso de seguridad.

## Buenas prácticas del proyecto

El proyecto procura mantener medidas como:

- Validación de datos de entrada.
- Autenticación y autorización por roles.
- Protección de endpoints administrativos.
- Revocación de sesiones.
- Idempotencia en operaciones sensibles.
- Rate limiting.
- Gestión segura de secretos mediante variables de entorno.
- Dependencias actualizadas y análisis automático de dependencias.
- Pruebas automatizadas.
- Revisión de seguridad durante cambios importantes.
- Principio de mínimo privilegio.
- Registro de eventos relevantes de seguridad.

## Agradecimientos

Agradecemos a investigadores, desarrolladores y usuarios que reporten problemas de seguridad de manera responsable y ayuden a mejorar la seguridad de Burger Danlin.

---

*Última actualización: 2026-10-03*
