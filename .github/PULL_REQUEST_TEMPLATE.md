## Resumen

Describe brevemente el cambio.

## Validación

- [ ] Lint/typecheck pasa.
- [ ] Tests pasan.
- [ ] Build pasa.
- [ ] Revisé que no se incluyan secretos ni datos sensibles.

## Base de datos

Marca esta sección cuando el PR modifica `database/prisma/schema.prisma`, `database/prisma/migrations/**` o transforma datos persistidos.

- [ ] No aplica.
- [ ] **Expand** — cambio aditivo y compatible con la versión anterior.
- [ ] **Migrate** — migración/backfill o transición de datos.
- [ ] **Contract** — eliminación/endurecimiento después de completar la transición.
- [ ] Revisé manualmente el SQL de la migración.
- [ ] La versión anterior de la aplicación sigue siendo compatible, o documenté por qué Contract ya es seguro.
- [ ] Evalué locks, duración y volumen de datos.
- [ ] Documenté backfill cuando aplica.
- [ ] Documenté rollback/forward recovery.
- [ ] Para un cambio destructivo, existe backup y evidencia de que la estructura anterior ya no se usa.

Referencia: `docs/DATABASE_MIGRATIONS.md`.
