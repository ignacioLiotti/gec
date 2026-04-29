# Domain Model Backlog (Consolidado)

Estado consolidado de decisiones de dominio vs brechas de implementacion.
Fecha de corte: 2026-04-27.

## Avance actual

- Avance estimado del domain model: **~80% cerrado**.
- Temas ya cerrados:
  - precedencia tenant vs obra
  - versionado doble baseline/effective
  - clasificacion de compatibilidad
  - trazabilidad de force sync con entidad dedicada
  - autorizacion destructiva
  - preview snapshot inmutable con hash + HMAC
  - identidad y lineage (`lineage_row_key`, doble fingerprint, materialization version)
  - calculo hibrido (recompute + snapshots versionados)
  - recomendaciones (policy no-blocking default, estados, dedupe/supersede)
  - data-flow general vs data-flow de obra
  - layout General como configuracion persistida de data-flow
  - lineage fisico inicial para filas extraidas
  - overrides de macrotabla con binding estable por lineage
  - flujos documentales como contrato tenant de extraccion
  - chat persistido por usuario y tenant
- Temas aun abiertos: eventos de dominio, permisos finos por tenant, dato critico configurable, cierre tecnico de canonicalizacion y rollout de implementacion.

## Estado no commiteado relevante (2026-04-27)

- Data-flow:
  - `tenant_data_flow_config` como persistencia tenant de calculos/resultados/layout.
  - `/excel/data-flow` para editar el data-flow general.
  - `/excel/[obraId]/data-flow` para editar overrides particulares.
  - Merge efectivo tenant -> obra para evaluar resultados en una obra.
  - Calculos base: contrato, certificado, saldo y avance.
  - Inputs de formula desde tabla, macrotabla, otro calculo o campo de obra.
  - Canvas con React Flow y editor visual de layout con React Grid Layout.
- Solapa General:
  - La vista final consume `generalTabLayout`.
  - La grilla final respeta `gridX`, `gridY`, `gridH` y `width` igual que el editor.
  - Bloques soportados: avance, curva, informacion general, datos financieros, campos configurados, certificados y resultado custom.
- Lineage:
  - Migracion inicial para `lineage_row_key`, `extraction_id`, `materialization_version` y fingerprints OCR.
  - Utilidad `lib/lineage.ts` para fingerprint y derivacion deterministica de claves.
  - Import OCR simple/multiple/spreadsheet prepara filas con identidad estable y errores clasificados.
  - Panel y API de lineage para navegar documento, extraccion, tabla, fila, macrotabla y override.
- Macrotablas:
  - Overrides con `source_tabla_id`, `lineage_row_key`, `binding_status` y `binding_error`.
  - Resolucion dual stable/legacy y deteccion de conflictos de reattach.
- Flujos documentales:
  - Pantallas admin para configurar carpetas, tablas extraidas, templates, instrucciones, metodos de entrada y consumidores.
  - Editor por carpeta en file manager para inspeccionar pipeline y conflictos.
- Chat:
  - Migracion de conversaciones/mensajes.
  - Panel global lazy-loaded para usuarios no demo.
  - Herramientas tenant-scoped para consultar obras, tablas, documentos y datos extraidos.
- Governanza pendiente:
  - Los TODOs de default-folder force sync documentan que falta `migration_runs`, preview, aprobacion destructiva y snapshot integrity.
  - Falta versionar formalmente el contrato de grilla del layout General.

## 1) ADR o dominio que falta aclarar o tomar decisiones

- `ADR-XXXX`: Canonicalizacion final del preview snapshot (detalle de JCS RFC 8785 + reglas de arrays/identidades de negocio + estrategia de compatibilidad retroactiva entre versiones).
- `ADR-XXXX`: Estrategia de rollback/compensacion para migraciones destructivas (granularidad, automatico vs manual, criterios de rollback parcial).
- `ADR-XXXX`: Contrato de eventos de dominio (catalogo minimo, semantica de entrega, idempotencia, outbox/event bus).
- Dominio pendiente: modelo de permisos tenant-configurable para acciones sobre recomendaciones blocking (reglas, precedencia, auditoria).
- Dominio pendiente: catalogo de `Dato Critico` (quien define, versionado, precedencia tenant/base vs obra/local).
- Dominio pendiente: contrato formal de `subject_ref` versionado (`subject_ref = <kind>:<id>[:<scope>]`) con parser/validator canonico.

## 2) Cambios en codigo que faltan diagramar/implementar

- Ver `docs/epics/epica-1-lineage-e-identidad-estable-de-datos.md` para el desglose operativo de la Épica 1 y sus tickets 1.1/1.2.
- Implementar entidad dedicada `migration_runs` (o equivalente) y desacoplarla de `background_jobs`.
- Implementar pipeline formal `planned -> validated -> running -> completed|failed|rolled_back` con cierre auditable siempre.
- Implementar preview obligatorio para toda destructiva con `impacto_estimado` completo y persistido.
- Implementar verificacion de snapshot congelado: hash canonico + firma HMAC + `snapshot_canonicalization_version`.
- Implementar aprobacion destructiva efectiva: `approved_by`, `approved_role`, `why`, token one-shot, expiracion, invalidacion por cambio de scope.
- Persistir baseline/effective schema version before/after en migraciones y en tablas afectadas.
- Implementar `lineage_row_key`, `extraction_id`, `materialization_version` como columnas fisicas e indices de unicidad.
- Migrar continuidad de macrotabla: de `source_row_id` tecnico a identidad estable por lineage (dual-read/dual-write transitorio).
- Persistir versionado compuesto de calculo en snapshots/logs (`engine_version`, `rule_pack_version`, `effective_rule_hash`).
- Implementar modelo de recomendaciones en storage/API:
  - estados canonicos
  - recommendation_subject_key
  - subject_ref canonico versionado
  - supersede deterministico
  - expiracion por evento + timeout

## 3) Mejoras en el codigo que faltan diagramar/implementar

- Definir estrategia de concurrencia e idempotencia para force sync y reimports (locks, dedupe keys, reintentos seguros).
- Agregar controles de integridad y jobs de reconciliacion:
  - huellas de snapshot
  - coherencia baseline/effective
  - continuidad de lineage en reimports
- Mejorar observabilidad:
  - metricas de impacto estimado vs real
  - tasa de fallas por clase de compatibilidad
  - trazabilidad de recomendaciones por estado
- Endurecer testing:
  - tests de clasificacion deterministica
  - tests de autorizacion destructiva
  - tests de dedupe/supersede de recomendaciones
  - tests de reproducibilidad historica de calculos
- Definir playbook de migracion de datos para rollout incremental (backfill, dual-write, verificacion, cutover, cleanup).

## 4) Nuevas features en el codigo que faltan diagramar/implementar

- Centro de recomendaciones en UI (detalle accionable + vista resumida global/macrotabla).
- Flujo de aprobacion/ejecucion destructiva con preview congelado visible y evidencia auditable.
- Explainability de calculos: ver fuentes, lineage, versiones de reglas y motor usadas en cada snapshot.
- Editor de policies tenant para recomendaciones:
  - no-blocking/blocking por regla/severidad
  - permisos de aceptacion/rechazo
  - retries y expiracion
- Dashboard de migraciones:
  - planned/validated/running/completed/failed/rolled_back
  - impacto estimado vs real
  - errores y rollback_reference
- (Futuro de producto) generacion de documentos desde datos estructurados con trazabilidad de origen.

## Donde empezar a aplicar mejoras y cambios (orden recomendado)

1. Gobernanza de migraciones destructivas (entidad + preview + aprobacion + snapshot integrity).
2. Lineage fisico en OCR/macrotablas (continuidad de negocio y reconciliacion).
3. Recomendaciones end-to-end (modelo de estados + dedupe/supersede + eventos + UI minima).
4. Endurecimiento transversal (tests, observabilidad, backfills, playbooks).
