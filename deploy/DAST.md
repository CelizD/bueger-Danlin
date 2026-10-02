# DAST de staging — Burger Danlin

Fecha de preparación: **2 de octubre de 2026**

El repositorio incluye un workflow manual de OWASP ZAP:

```text
.github/workflows/dast.yml
```

Su objetivo es detectar problemas observables desde una aplicación desplegada sin convertir producción en un laboratorio de pruebas.

## 1. Estado actual

La automatización está **preparada**, pero no puede considerarse ejecutada hasta disponer de un entorno staging HTTPS accesible desde GitHub Actions.

No se configura una URL por defecto y el workflow falla de forma segura si faltan las variables de allowlist.

## 2. Configuración del environment `staging`

En GitHub, crear un Environment llamado exactamente:

```text
staging
```

Configurar estas variables del environment:

```text
DAST_TARGET_URL=https://staging.tu-dominio.example/
DAST_ALLOWED_HOST=staging.tu-dominio.example
```

`DAST_ALLOWED_HOST` debe ser exactamente el hostname de `DAST_TARGET_URL`.

El workflow exige HTTPS y se niega a escanear otro hostname. Esto evita que un error al ejecutar el workflow apunte a un tercero o a otra infraestructura.

Cuando exista un dominio real, usar un subdominio claramente separado de producción.

## 3. Baseline scan

Modo:

```text
baseline
```

Es el primer escaneo que debe ejecutarse.

Características del workflow:

- manual mediante `workflow_dispatch`;
- spider limitado;
- análisis pasivo;
- sin creación automática de GitHub Issues;
- genera artefacto/reporte ZAP;
- falla el job cuando ZAP devuelve hallazgos que su acción considera no aceptables.

Ejecutarlo después de desplegar staging y antes del escaneo activo.

## 4. Full active scan

Modo:

```text
full
```

Este modo realiza pruebas activas contra el target y **puede enviar requests maliciosos o modificar datos del entorno**.

Por eso exige escribir exactamente:

```text
ACTIVE-STAGING
```

en el input `active_scan_confirmation`.

Reglas:

- nunca usar contra producción;
- usar únicamente en un staging autorizado y desechable/reparable;
- no conectar staging a credenciales reales de Mercado Pago;
- mantener `ENABLE_REAL_PAYMENTS=false`;
- no usar SMTP real;
- usar datos de prueba;
- restaurar/resembrar el entorno si el escaneo altera datos.

El job tiene además un timeout para evitar una ejecución indefinida.

## 5. Orden recomendado

1. desplegar staging desde un commit conocido;
2. confirmar HTTPS;
3. configurar el environment `staging`;
4. ejecutar `baseline`;
5. revisar el reporte;
6. corregir o documentar falsos positivos;
7. ejecutar nuevamente `baseline`;
8. ejecutar `full` con la confirmación explícita;
9. revisar hallazgos;
10. repetir después de correcciones relevantes.

## 6. Qué evidencia conservar

Por cada ejecución importante guardar:

- commit/branch desplegado;
- fecha y hora;
- URL/hostname de staging;
- modo baseline/full;
- resultado del workflow;
- artefacto ZAP;
- hallazgos confirmados;
- falsos positivos revisados;
- PR/commit que corrige cada hallazgo.

No guardar cookies, credenciales, tokens ni datos personales reales dentro de tickets o reportes compartidos.

## 7. Gate

El control DAST pasa de **preparado** a **validado** solamente cuando:

- staging real existe;
- baseline termina y sus hallazgos fueron revisados;
- full active scan se ejecuta sobre ese staging autorizado;
- no quedan hallazgos críticos/altos confirmados sin resolver o aceptar formalmente.

DAST complementa SAST, SCA, E2E y revisión manual; no los sustituye.
