# Runbook — Dependencia o supply chain comprometida

## Disparadores

- advisory crítico de una dependencia instalada;
- paquete retirado o comprometido;
- lockfile modificado sin explicación;
- acción GitHub comprometida;
- imagen base comprometida;
- Semgrep/audit/Trivy/Gitleaks detectan un hallazgo de alto impacto;
- comportamiento de build/runtime no explicado.

## Contención

1. detener merges/deploys relacionados;
2. identificar versión exacta, lockfile, imagen y commit desplegado;
3. no ejecutar reinstalaciones ciegas si pueden destruir evidencia;
4. si existe posibilidad de ejecución de código con secretos, iniciar también el runbook de filtración de secretos;
5. si producción puede estar ejecutando código comprometido, retirar/reemplazar el componente afectado por una versión conocida como segura.

## Investigación

Revisar:

- `pnpm-lock.yaml`;
- cambios de `package.json`;
- Dependabot/advisories;
- salida de `pnpm audit --prod --audit-level=high`;
- Semgrep;
- SBOM;
- Trivy de imágenes;
- hashes/SHA de GitHub Actions;
- Dockerfiles e imágenes base;
- scripts install/postinstall del paquete involucrado.

Determinar si el componente comprometido estuvo:

- solo en devDependencies;
- presente en build;
- incluido en runtime;
- ejecutándose con acceso a secretos o red;
- desplegado a producción.

## Recuperación

1. actualizar, retirar o fijar a versión confiable;
2. regenerar lockfile de forma controlada;
3. reconstruir imágenes desde un commit confiable;
4. ejecutar CI completo;
5. exigir Security verde;
6. exigir Trivy verde para imágenes productivas;
7. desplegar artefactos reconstruidos;
8. rotar secretos si pudo existir lectura de secretos durante build/runtime.

## Validación

No basta con que `pnpm audit` quede verde. Confirmar que:

- el paquete/version comprometido ya no aparece en lockfile/SBOM;
- las imágenes fueron reconstruidas;
- no se reutilizó una imagen antigua;
- el servicio funciona con E2E y health checks;
- no hay actividad anómala posterior.

## Cierre

Documentar paquete/acción/imagen, versiones afectadas, commits desplegados, exposición real, secretos rotados y control preventivo agregado.
