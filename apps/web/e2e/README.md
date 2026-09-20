# Frontend E2E

Esta suite usa Playwright para validar el navegador real sin depender todavía de PostgreSQL/API para los smoke tests del frontend.

## Cobertura inicial

- flujo cliente: menú -> datos -> pedido -> pago mock -> QR;
- sessionStorage del capability token del pedido;
- skip link y navegación inicial por teclado;
- login de personal;
- transición de login a MFA;
- error de credenciales accesible;
- axe WCAG A/AA con bloqueo para impactos serious/critical.

Los endpoints se interceptan desde Playwright para mantener las pruebas deterministas.

## Dependencias

Desde la raíz del repositorio:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @burger/web add -D @playwright/test@1.63.0 @axe-core/playwright@4.13.0
```

Después instala Chromium:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @burger/web exec playwright install chromium
```

## Ejecutar

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @burger/web test:e2e
```

Con navegador visible:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @burger/web test:e2e:headed
```

El HTML report queda fuera de Git.

## Siguiente nivel

Estos tests son E2E del frontend con API simulada. No sustituyen un test integrado real.

La siguiente suite debe levantar:

- PostgreSQL de test;
- API real;
- Web real;
- seed determinista;
- pedido real;
- transición cocina;
- QR/entrega real;
- limpieza de DB posterior.
