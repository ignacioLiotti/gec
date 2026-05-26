# Multi-tenant Obras Platform

Contexto de dominio para una plataforma multi-tenant centrada en obras, documentos, extraccion de datos, tablas editables y consolidacion transversal.

## Language

**Plantilla Tenant**:
Configuracion base comun definida a nivel tenant para carpetas, tablas y columnas.
_Avoid_: config global, default suelto

**Identidad Estructural Comun**:
Conjunto minimo de identidades (por ejemplo, claves de columna) que permite comparar y consolidar datos entre obras del mismo tenant.
_Avoid_: esquema compartido implicito

**Instancia de Obra**:
Materializacion concreta de la plantilla tenant para una obra especifica.
_Avoid_: copia temporal, espejo

**Datos Historicos de Obra**:
Filas y documentos ya registrados en una instancia de obra.
_Avoid_: cache de extraccion

**Sincronizacion No Destructiva**:
Propagacion por defecto de cambios de plantilla que no elimina ni invalida datos historicos ni customizaciones locales de obra.
_Avoid_: sync total, reaplicar todo

**Customizacion Local de Obra**:
Ajuste de schema o configuracion hecho en una obra materializada que no cambia la plantilla tenant.
_Avoid_: override global

**Cambio Destructivo**:
Cambio de plantilla que rompe compatibilidad de schema o puede perder informacion historica en obras existentes.
_Avoid_: simple update

**Migracion Explicita**:
Accion intencional y trazable para imponer cambios incompatibles sobre instancias de obra.
_Avoid_: sync automatica

**Force Sync**:
Mecanismo tecnico que ejecuta una migracion explicita imponiendo compatibilidad con la plantilla en escenarios incompatibles.
_Avoid_: sincronizacion normal

**Migration Run**:
Entidad dedicada que registra una ejecucion de migracion explicita de inicio a fin, con trazabilidad completa e impacto.
_Avoid_: usar solo background job sin contexto de negocio

**Preview de Impacto**:
Validacion previa obligatoria para estimar alcance de una migracion explicita antes de ejecutarla.
_Avoid_: ejecutar force sync a ciegas

**Compatibilidad de Cambio**:
Clasificacion del cambio como `no destructiva`, `semidestructiva` o `destructiva` para gobernar validaciones y permisos.
_Avoid_: cambio sin clasificacion

**Estado de Migracion**:
Maquina de estados formal: `planned | validated | running | completed | failed | rolled_back`.
_Avoid_: estado tecnico minimo pending/done/failed

**Baseline Schema Version**:
Version canonica por tabla default de tenant que representa la identidad estructural comun y comparable entre obras.
_Avoid_: version local aislada

**Effective Schema Version**:
Version real de una tabla en obra que combina baseline + desvios locales explicitos.
_Avoid_: asumir que toda obra coincide con baseline

**Modelo de Versionado Doble**:
Regla canonica donde coexisten version base (tenant default tabla) y version efectiva (tabla de obra).
_Avoid_: version unica para todos los contextos

**Aprobacion Destructiva**:
Autorizacion explicita de owner/admin para ejecutar una migracion destructiva sobre un preview validado y congelado.
_Avoid_: ejecutar por privilegio tecnico sin aprobacion de negocio

**Preview Snapshot Congelado**:
Instantanea inmutable del scope e impacto estimado aprobada para una ejecucion destructiva.
_Avoid_: preview mutable durante ejecucion

**Approval Token One-shot**:
Token de un solo uso, ligado a `migration_run_id` y al snapshot aprobado, con expiracion.
_Avoid_: token reutilizable para reintentos indefinidos

**Preview Snapshot Canonico**:
Payload canonico e inmutable del cambio evaluado que se usa como evidencia aprobable para ejecutar migraciones destructivas.
_Avoid_: snapshot ad-hoc sin campos obligatorios estables

**Snapshot Hash + HMAC**:
Hash estable del JSON canonico del snapshot, firmado con HMAC del servidor para garantizar integridad y origen.
_Avoid_: hash sobre JSON incidental o sin firma de servidor

**Lineage Row Key**:
Identidad de negocio estable de una fila extraida para continuidad entre reimports, independiente del `row.id` tecnico.
_Avoid_: usar solo `row.id` mutable como identidad de negocio

**Version de Materializacion**:
Instancia tecnica de extraccion de un documento en un momento dado que puede cambiar `row.id` sin cambiar entidad de negocio.
_Avoid_: asumir que nueva extraccion implica nueva entidad de negocio

**File Fingerprint**:
Hash binario del archivo para responder si dos cargas son exactamente el mismo archivo.
_Avoid_: inferir identidad exacta desde nombre/path

**Content Fingerprint Normalized**:
Hash del contenido util normalizado (OCR/representacion semantica) para reconciliacion de continuidad.
_Avoid_: usar solo bytes para continuidad semantica

**Snapshot de Calculo Versionado**:
Persistencia historica de resultados calculados con metadatos de origen y version de regla para auditoria y reproducibilidad.
_Avoid_: depender solo de recomputacion al vuelo para explicaciones historicas

**Obra**:
Unidad central de gestion operativa y economica sobre la que se organiza toda informacion relevante del sistema.
_Avoid_: proyecto como entidad pasiva sin estado vivo

**Tabla de Obras Operativa**:
Vista global tipo hoja de calculo para edicion masiva y navegacion rapida de obras.
_Avoid_: tratarla como fuente de verdad conceptual

**Detalle de Obra**:
Vista de decision que prioriza informacion critica de la obra (estado, indicadores, calculos y recomendaciones).
_Avoid_: espejo completo de todos los datos sin curacion

**Tabla de Extraccion**:
Estructura de datos derivada de documentos que alimenta calculos, reportes y macrotablas.
_Avoid_: almacenamiento documental sin estructura operativa

**Recomendacion**:
Sugerencia explicita de accion generada por el sistema a partir de cambios de datos o resultados de calculo.
_Avoid_: calculo silencioso sin accion sugerida

**Recommendation Subject Key**:
Clave canonica de deduplicacion/supersede para una recomendacion en un asunto concreto: `obra_id + rule_key + subject_ref`.
_Avoid_: deduplicar solo por regla o solo por obra

**Subject Ref Canonico**:
Referencia estructurada y versionable del sujeto de negocio de una recomendacion: `subject_ref = <kind>:<id>[:<scope>]`.
_Avoid_: subject_ref libre sin contrato de parseo

**Policy de Recomendacion**:
Politica que define si una recomendacion es no-blocking o blocking segun regla, severidad y configuracion por tenant.
_Avoid_: decidir blocking ad-hoc por pantalla

**Estado de Recomendacion**:
Estado del ciclo de vida auditable de una recomendacion desde deteccion hasta cierre tecnico/automatico.
_Avoid_: representar recomendaciones solo como abiertas/cerradas

**Evento de Dominio**:
Hecho de negocio relevante (por ejemplo documento_subido, extraccion_completada, fila_actualizada, calculo_recalculado) usado para orquestar flujos y recomendaciones.
_Avoid_: acoplar toda reaccion a llamadas directas sin eventos

**Dato Critico**:
Dato priorizado para decision en detalle de obra, definido por reglas de negocio/configuracion y no por disponibilidad tecnica.
_Avoid_: mostrar todo sin jerarquia de criticidad

**Data-flow General**:
Configuracion de calculos, resultados y layout definida a nivel tenant y aplicable a todas las obras.
_Avoid_: calculos hardcodeados por pantalla

**Data-flow de Obra**:
Configuracion local de calculos, resultados y layout que pertenece a una obra especifica.
_Avoid_: customizacion tenant accidental

**Configuracion Efectiva de Data-flow**:
Composicion evaluable entre **Data-flow General** y **Data-flow de Obra**, donde la obra puede sobrescribir bloques o resultados generales por identidad estable.
_Avoid_: mezclar configs sin precedencia explicita

**Calculo Base**:
Calculo semilla no eliminable que expresa un indicador canonico del negocio, como contrato, certificado, saldo o avance.
_Avoid_: KPI especial hardcodeado

**Campo de Obra como Fuente**:
Valor propio de la obra usado como input de una formula de data-flow sin pasar por tabla ni macrotabla.
_Avoid_: tratar todo input como tabla

**Resultado General**:
Salida visible de data-flow destinada a alimentar indicadores transversales y el layout de la solapa General.
_Avoid_: widget visual sin resultado trazable

**Layout General**:
Configuracion ordenable y redimensionable de bloques que define como se presenta la solapa General de una obra.
_Avoid_: layout fijo embebido en JSX

**Bloque de Layout General**:
Unidad del **Layout General** con identidad estable, tipo, posicion, tamano y seleccion de campos/resultados.
_Avoid_: card anonima sin persistencia

**Canvas de Trazabilidad**:
Vista explorable que representa dependencias reales desde documentos y tablas hasta calculos y resultados.
_Avoid_: diagrama decorativo

**Nodo de Trazabilidad**:
Entidad visual del canvas que representa una fuente, tabla, campo de obra, calculo o resultado con estado y metadatos inspeccionables.
_Avoid_: tooltip como fuente de verdad

**Nodo Real de Trazabilidad**:
Nodo cuyo backing sale de entidades persistidas del dominio, como tablas, filas materializadas, macrotablas o configuraciones tenant/obra reales.
_Avoid_: asumir que todo nodo del canvas existe fisicamente en storage o DB

**Nodo Projected de Trazabilidad**:
Nodo inferido desde reporting, hallazgos, consumers o wiring de UI cuando todavia no existe como entidad persistida general.
_Avoid_: presentarlo como si tuviera el mismo grado de verdad que un nodo real

**Modo Simplificado de Trazabilidad**:
Vista por defecto que prioriza tablas, macrotablas y resultados visibles, ocultando capas projected mas tecnicas hasta que el usuario pida mas detalle.
_Avoid_: mostrar todo el grafo completo siempre

**Flujo Documental**:
Configuracion tenant que conecta carpetas, tipos documentales, estrategia de extraccion, tablas destino, politica de lineage y consumidores.
_Avoid_: carpeta OCR aislada

**Borrador de Documento Generado**:
Instancia editable previa a generar el archivo final de un documento operativo, siempre anclada a tenant + obra + carpeta + plantilla.
_Avoid_: formulario temporal sin trazabilidad

**Documento Generado**:
Documento operativo creado por plantilla que termina persistido como archivo documental normal de la obra y conserva metadata de origen, version de plantilla y datos de entrada.
_Avoid_: documento paralelo fuera del file manager

**Revision de Documento Generado**:
Ciclo de vida del documento operativo: al crearse queda `UNDER_REVIEW` (Esperando revision), puede editarse mientras espera revision o si fue rechazado, no puede editarse una vez aprobado, y las decisiones de aprobacion/rechazo se auditan como eventos.
_Avoid_: editar aprobados o crear documentos nuevos al corregir rechazados

**Firma Digital de Aprobacion**:
Imagen de firma configurada por usuario revisor y aplicada al aprobar un documento generado; reemplaza el sello visual de aprobado en preview y PDF exportado.
_Avoid_: aprobaciones sin evidencia de firmante cuando el flujo exige firma

**Pipeline de Extraccion**:
Secuencia operativa Documento -> OCR/manual/spreadsheet -> Tabla de Extraccion -> Lineage -> Consumidores.
_Avoid_: importacion como evento aislado

**Override Estable de Macrotabla**:
Valor custom de macrotabla ligado a identidad estable de fila mediante `source_tabla_id + lineage_row_key`.
_Avoid_: override atado solo a source_row_id

**Error OCR Clasificado**:
Falla de extraccion persistida con codigo estable para separar problemas de proveedor, lineage y validacion.
_Avoid_: mensaje libre como contrato de error

**Asistente Conversacional de Tenant**:
Chat persistido por usuario y tenant que puede consultar informacion estructurada mediante herramientas controladas.
_Avoid_: chat stateless sin contexto tenant

## Relationships

- Una **Plantilla Tenant** define la base de muchas **Instancias de Obra**.
- Cada **Instancia de Obra** es duenia de sus **Datos Historicos de Obra**.
- La propagacion por defecto entre plantilla e instancias debe ser **Sincronizacion No Destructiva**.
- Una **Customizacion Local de Obra** prevalece ante un **Cambio Destructivo** originado por plantilla.
- Un **Cambio Destructivo** solo puede aplicarse mediante **Migracion Explicita** (por ejemplo via **Force Sync**).
- Toda **Migracion Explicita** debe tener un **Migration Run** dedicado.
- Todo **Cambio Destructivo** requiere **Preview de Impacto** antes de ejecutar.
- Todo **Migration Run** debe terminar con **Estado de Migracion** auditable, incluso en fallas parciales.
- Toda tabla default de tenant tiene una **Baseline Schema Version**.
- Toda tabla de obra referencia una **Baseline Schema Version** y puede tener **Effective Schema Version** propia.
- Toda migracion **destructiva** requiere **Aprobacion Destructiva** previa por owner/admin.
- Toda ejecucion destructiva valida un **Preview Snapshot Congelado**.
- Toda ejecucion destructiva consume un **Approval Token One-shot**.
- Toda ejecucion destructiva valida **Snapshot Hash + HMAC** del **Preview Snapshot Canonico**.
- Un **Lineage Row Key** puede mapear multiples **Versiones de Materializacion** a lo largo del tiempo.
- Flujo de valor canonico del producto: **Documento -> Extraccion -> Tabla de Extraccion -> Calculo -> Obra -> Decision**.
- Un **Data-flow General** alimenta muchas **Configuraciones Efectivas de Data-flow**.
- Un **Data-flow de Obra** puede sobrescribir elementos del **Data-flow General** por identidad estable, sin modificar el tenant.
- Una **Configuracion Efectiva de Data-flow** produce **Resultados Generales** y **Bloques de Layout General** para el **Detalle de Obra**.
- Un **Calculo Base** puede depender de **Campos de Obra como Fuente**, tablas, macrotablas u otros calculos.
- El **Canvas de Trazabilidad** debe respetar la direccion canonica **Documento -> Tabla de Extraccion/Macrotabla/Campo de Obra -> Calculo -> Resultado General**.
- Un **Canvas de Trazabilidad** puede mezclar **Nodos Reales de Trazabilidad** y **Nodos Projected de Trazabilidad**, pero debe distinguirlos explicitamente.
- Un **Flujo Documental** define el contrato de un **Pipeline de Extraccion** antes de que existan documentos concretos.
- Un **Documento Generado** no vive en un mundo aparte: debe terminar como archivo normal dentro del sistema documental de la obra, con metadata adicional de generacion.
- Un **Override Estable de Macrotabla** referencia un **Lineage Row Key**, no solamente una **Version de Materializacion**.
- Un **Asistente Conversacional de Tenant** pertenece a un usuario dentro de un tenant y sus herramientas solo consultan datos autorizados para ese tenant.

## Business rules

### Contrato minimo de Migration Run (obligatorio)

- Toda **Migracion Explicita** debe persistir una entidad dedicada de ejecucion.
- Campos minimos requeridos por ejecucion:
  - `who`: actor y rol
  - `why`: motivo/justificacion
  - `what`: scope exacto (tenant, obras, carpetas, tablas, columnas)
  - `compatibility`: `no destructiva | semidestructiva | destructiva`
  - `impacto_estimado`: obras/tablas/columnas/filas/documentos-vinculos
  - `impacto_real`: mismos conteos del impacto estimado
  - `estado`: `planned | validated | running | completed | failed | rolled_back`
  - `errores`: detalle de fallas encontradas
  - `rollback_reference`: referencia a compensacion/rollback cuando exista
  - `started_at`, `finished_at`
  - `schema_version_before`, `schema_version_after` (o equivalente de identidad estructural)

### Reglas operativas obligatorias

- Toda vista de trazabilidad debe degradar primero las capas projected antes de romper la capa real.
- Un **Nodo Projected de Trazabilidad** nunca puede mostrarse como equivalente a un **Nodo Real de Trazabilidad** sin soporte status visible.

- Ningun `force sync` destructivo se ejecuta sin preview de `impacto_estimado`.
- Ningun `force sync` puede quedar sin resultado auditable final, incluso con falla parcial.

### Regla de versionado estructural

- El sistema adopta **Modelo de Versionado Doble**.
- La version base se calcula sobre atributos estructurales semanticos (por ejemplo `field_key`, `data_type`, `required`, `ocr_scope`, `order` y equivalentes).
- `schema_version_before/after` en migraciones explicitas debe registrar baseline y effective cuando aplique.
- La comparabilidad transversal y la gobernanza se apoyan en baseline.
- La operacion real de cada obra se apoya en effective.

### Taxonomia deterministica de compatibilidad

- El sistema usa una tabla fija de reglas por tipo de diff estructural.
- `no destructiva`: cambios aditivos/compatibles sin reinterpretacion ni remapeo de datos existentes.
- `semidestructiva`: cambios remapeables/coercibles automaticamente con riesgo acotado y validable.
- `destructiva`: cambios con potencial de perdida, incompatibilidad fuerte o ruptura semantica.
- Regla de decision: la clasificacion final toma la mayor severidad detectada en el diff.
- Regla de prueba: si el sistema no puede demostrar compatibilidad total, no puede clasificar como `no destructiva`.
- Regla de escalamiento: si no puede demostrar remapeo/coercion segura, escala a `destructiva`.

### Regla de autorizacion para destructivas

- Se adopta aprobacion simple por owner/admin ahora, con opcion futura de doble aprobacion configurable.
- Una migracion destructiva solo puede ejecutarse despues de una aprobacion explicita sobre un preview validado y congelado.
- El contrato minimo de aprobacion exige: `approved_by`, `approved_role`, `why`, `migration_run_id`, `compatibility_class=destructiva`, `preview_snapshot`, `approval_token`, `approved_at`, `token_expires_at`.
- No se ejecuta destructiva sobre diff distinto del preview aprobado.
- Si cambia scope o impacto estimado, la aprobacion caduca y debe reaprobarse.
- El token es de un solo uso.
- Si falla y requiere nueva ejecucion, por defecto requiere revalidacion/reaprobacion.
- Ningun rol distinto de owner/admin puede autorizar destructivas.

### Contrato de preview snapshot inmutable

- El `preview_snapshot` aprobado se serializa como JSON canonico, luego se calcula hash estable y firma HMAC de servidor.
- Campos obligatorios del snapshot:
  - `compatibility_class`
  - `scope` (`tenant`, `obras`, `carpetas`, `tablas`, `columnas`)
  - `impacto_estimado`
  - `schema_version_before` (`baseline`, `effective`)
  - `schema_version_after` (`baseline`, `effective`) cuando aplique en preview
  - `classification_rules_version`
  - `migration_run_id`
  - `generated_at`
  - `diff_summary`
  - `rollback_capability`
  - `approval_scope` cuando se limite la autorizacion
- Regla de ejecucion: solo se ejecuta si snapshot recomputado == snapshot aprobado (mismo hash y firma valida).
- Cualquier cambio en campos del snapshot invalida la aprobacion.
- `classification_rules_version` es obligatoria para fijar semantica de clasificacion.
- Decision provisional de canonicalizacion: Opcion C.
  - JSON base con JCS/RFC 8785.
  - Reglas de dominio versionadas para arrays e identidades de negocio.
  - Campo obligatorio: `snapshot_canonicalization_version`.
  - El detalle fino de canonicalizacion se delega a ADR tecnico de implementacion.

### Regla canonica de identidad y lineage de fila extraida

- `row.id` es identidad tecnica mutable de la fila materializada.
- `lineage_row_key` es la identidad estable de negocio para reconciliacion entre reimports.
- Doble fingerprint obligatorio como insumos de identidad:
  - `file_fingerprint` para trazabilidad documental/deduplicacion exacta.
  - `content_fingerprint_normalized` para continuidad semantica.
- Construccion de `lineage_row_key` por prioridad:
  - clave de negocio explicita (cuando el tipo documental/template la define)
  - clave derivada estructural (`file_fingerprint` + `content_fingerprint_normalized` + `table_identity` + `item_logical_key`)
  - fallback deterministico (`file_fingerprint` + `content_fingerprint_normalized` + `table_identity` + `item_position`)
- `lineage_row_key` no depende de un solo fingerprint aislado; usa ambos como insumos dentro de la estrategia hibrida.
- La posicion no puede ser identidad principal salvo fallback.
- Cada reimport crea nueva version de materializacion, pero debe reconciliar con `lineage_row_key` existente.
- Mismo `lineage_row_key` implica misma entidad de negocio aunque cambie `row.id`.
- Los overrides de macrotabla no deben depender solo de `source_row_id`; deben poder reconciliarse por `lineage_row_key` (o relacion equivalente).

### Persistencia inicial de lineage (decision C)

- Se adopta como baseline inicial:
  - `obra_tabla_rows.id` = identidad tecnica mutable
  - `obra_tabla_rows.lineage_row_key` = identidad estable de negocio (columna fisica)
  - `obra_tabla_rows.extraction_id` = referencia auditable del proceso OCR/extraccion que genero la materializacion
  - `obra_tabla_rows.materialization_version` = orden local de evolucion para (`tabla_id`, `lineage_row_key`)
- `lineage_row_key` debe estar en columna fisica (no solo JSON) para indexacion, unicidad, joins y reconciliacion eficiente.
- Regla de unicidad inicial recomendada: `tabla_id + lineage_row_key` (o equivalente del modelo).
- Regla operativa: para una misma combinacion (`tabla_id`, `lineage_row_key`), cada rematerializacion por reimport/reconciliacion incrementa `materialization_version`.
- `macro_table_custom_values` debe evolucionar para continuidad por lineage estable.
- `source_row_id` puede mantenerse como referencia tecnica, pero no como unica identidad de negocio.
- Si se requiere historial de reconciliacion mas rico, evolucionar luego a mapping dedicado (`row_lineage_links` o equivalente).

### Regla canonica de calculo (modelo hibrido)

- Operacion actual: los valores calculados pueden recomputarse al vuelo desde fuentes vigentes.
- Auditoria/historia: deben existir snapshots materializados y versionados.
- Cuando el calculo deriva de filas extraidas, el snapshot debe poder referenciar:
  - `lineage_row_key`
  - `extraction_id` cuando aplique
  - `materialization_version`
  - versionado compuesto de calculo:
    - `engine_version`
    - `rule_pack_version`
    - `effective_rule_hash`
- Objetivo: flexibilidad operativa sin perder explicabilidad historica ante cambios de documentos, reimports o reglas.

### Reglas de producto sobre obras y decision

- Toda informacion operativa relevante pertenece a una **Obra**.
- La **Obra** combina nucleo minimo comun + estructura extensible por tenant.
- La **Tabla de Obras Operativa** esta optimizada para velocidad de edicion y overview global.
- El **Detalle de Obra** prioriza datos criticos para decision, no exhaustividad total.
- El sistema de calculos agrega valor de decision (no solo visualizacion), y puede disparar **Recomendaciones** explicitas.
- La carpeta define el tipo de dato de extraccion; el documento es el portador de evidencia.

### Reglas pendientes de modelado (recomendaciones + eventos)

- Las **Recomendaciones** deben definir: trigger, severidad y auditoria.
- Los **Eventos de Dominio** deben modelarse como contrato explicito para desacoplar extraccion, calculo y recomendaciones.
- Debe definirse gobernanza de **Dato Critico** (quien lo define, como se configura por tenant, y precedencia).

### Regla canonica de policy de recomendaciones

- Las recomendaciones son **no-blocking por defecto**.
- Solo se elevan a **blocking** por regla/severidad/policy explicita.
- La policy de blocking/no-blocking forma parte de la definicion de regla, no de decisiones ad-hoc de UI.
- El modo blocking se reserva para riesgo alto de inconsistencia, incumplimiento o decision incorrecta.

### Maquina de estados canonica de recomendaciones

- Flujo base: `proposed -> surfaced -> accepted | rejected -> applied | failed | expired | superseded`.
- Semantica:
  - `proposed`: la regla detecta una recomendacion valida.
  - `surfaced`: la recomendacion ya fue expuesta a usuario/sistema consumidor.
  - `accepted`: fue aceptada por usuario o policy.
  - `rejected`: fue rechazada por usuario o policy (cierre).
  - `applied`: la accion recomendada se ejecuto correctamente.
  - `failed`: se intento aplicar y fallo tecnicamente.
  - `expired`: cierre automatico por perdida de relevancia.
  - `superseded`: cierre automatico por reemplazo por una recomendacion mas nueva/correcta.
- Regla clave: `accepted` no implica `applied`; decision y ejecucion son pasos distintos.
- Para recomendaciones blocking, puede exigirse `surfaced` antes de continuar, sin cambiar la maquina base.

### Regla canonica de deduplicacion y supersede de recomendaciones

- La clave canonica es `recommendation_subject_key = obra_id + rule_key + subject_ref`.
- La deduplicacion se evalua por regla aplicada a un sujeto de negocio concreto dentro de la obra.
- `subject_ref` debe referir entidad estable del dominio (por ejemplo `lineage_row_key`, `tabla_id`, `period_key`, `campo_de_obra` o combinacion estable).
- Contrato de `subject_ref`: `subject_ref = <kind>:<id>[:<scope>]`.
  - Ejemplos: `row:lineage_row_key`, `table:tabla_id`, `field:obra_id:campo_key`, `period:obra_id:2024-01`, `aggregate:obra_id:costos_total`.
- Si llega una recomendacion nueva con el mismo `recommendation_subject_key`, la anterior debe evaluarse para `superseded` en vez de convivir como issue distinto.
- Si la recomendacion previa estaba `accepted` pero aun no `applied`, tambien debe pasar a `superseded` y se crea una nueva en `proposed`.
- Si cambia el sujeto real, no se deduplica aunque la regla sea la misma.

### Reglas operativas adicionales de recomendaciones

- `expired` se dispara tanto por timeout como por evento de invalidacion; prioridad al evento de invalidacion.
- La autorizacion para aceptar/rechazar recomendaciones blocking es configurable por tenant.
  - Minimo operativo actual: `owner` y `admin`.
  - Regla de dominio: no hardcodear roles en el core de recomendacion.
- Reintentos de aplicacion:
  - `applied -> failed` admite retry limitado por policy.
  - Si cambia el contexto de datos, no se recicla indefinidamente la misma recomendacion; se crea una nueva.
- Superficies de presentacion:
  - `Detalle de obra`: vista principal accionable.
  - `Tabla global/macrotabla`: vista resumida de la misma recomendacion.
- Motor de recomendaciones:
  - Modo canonico por defecto: async basado en eventos de dominio.
  - Modo sync: solo para casos criticos con bloqueo inmediato.

### Reglas canonicas de data-flow y layout General

- El **Data-flow General** es la fuente tenant para calculos y resultados comunes a todas las obras.
- El **Data-flow de Obra** almacena solo diferencias locales y puede sobrescribir calculos, resultados o bloques por `id`.
- La evaluacion de una obra siempre usa **Configuracion Efectiva de Data-flow**: primero tenant, luego overrides locales.
- Los calculos base canonicos son: `Contrato + ampliaciones`, `Certificado a la fecha`, `Saldo a certificar` y `Porcentaje de avance`.
- Los calculos base deben existir como calculos/resultados normales del builder, no como nodos especiales de UI.
- Un **Campo de Obra como Fuente** es un input valido de formula y debe aparecer en trazabilidad aunque no provenga de documento.
- El **Resultado General** debe ser trazable hasta su calculo y fuentes; la tarjeta KPI no sustituye esa trazabilidad.
- El **Layout General** se persiste como grilla de 12 columnas con `gridX`, `gridY`, `gridH` y `width`.
- El editor visual y la solapa General final deben interpretar la grilla con el mismo contrato de columnas, altura de fila y gap.
- Los bloques generales del tenant se aplican a todas las obras; los bloques particulares de obra sobrescriben a los generales con el mismo `id`.
- El **Canvas de Trazabilidad** abre inspector desde nodos, no desde tarjetas KPI, para separar seleccion visual de explicacion de dependencias.

### Reglas canonicas de flujos documentales y extraccion

- Un **Flujo Documental** pertenece al tenant y define carpetas, metodo de entrada (`ocr`, `manual`, `both`), instrucciones, templates, tablas destino y consumidores.
- Una carpeta no es solo storage: puede declarar estrategia de extraccion y politica de lineage para las tablas que materializa.
- Todo **Pipeline de Extraccion** debe producir evidencia suficiente para navegar Documento -> Extraccion -> Tabla -> Fila -> Consumidor.
- Los reimports no deben borrar y recrear filas como si fueran entidades nuevas si puede conservarse **Lineage Row Key**.
- Toda importacion OCR debe persistir `extraction_id` y, cuando sea posible, `file_fingerprint` y `content_fingerprint_normalized`.
- Si no se puede derivar identidad estable sin ambiguedad, el pipeline debe marcar conflicto de reconciliacion en vez de reatar silenciosamente.
- Un **Error OCR Clasificado** debe tener codigo estable (`OCR_PROVIDER_HIGH_DEMAND`, `LINEAGE_RECONCILIATION_CONFLICT` o equivalente) ademas del mensaje localizado.

### Reglas canonicas de macrotablas y overrides estables

- Los overrides de macrotabla deben resolverse por identidad estable (`source_tabla_id + lineage_row_key + column_id`) cuando este disponible.
- `source_row_id` se mantiene como compatibilidad tecnica, pero no debe ser la unica identidad para continuidad de negocio.
- Si multiples overrides compiten por la misma identidad estable y columna, el estado debe ser `conflict` y no debe elegirse un ganador implicitamente.
- Las vistas de macrotabla deben exponer resumen de bindings: estables, legacy y conflictos.

### Reglas canonicas del asistente conversacional

- Las conversaciones del asistente pertenecen a un usuario y tenant; no son compartidas por defecto.
- El contexto de conversacion puede recordar ultima obra o pagina, pero no reemplaza controles de acceso por tenant.
- Las herramientas del asistente consultan datos estructurados mediante APIs internas controladas y deben limitar cantidad de filas para analisis.
- Los mensajes, tool calls, tool results, uso de tokens y modelo deben persistirse para auditoria y continuidad de sesion.

## Example dialogue

> **Dev:** "Si el tenant elimina una columna base, la quitamos en todas las obras?"
> **Domain expert:** "No por defecto. Eso es destructivo. Solo via migracion explicita con trazabilidad."
>
> **Dev:** "Contrato y certificado son widgets fijos de la solapa General?"
> **Domain expert:** "No. Son resultados generales del data-flow tenant. Una obra puede sobrescribirlos localmente, pero siguen siendo calculos trazables."
>
> **Dev:** "Si reimporto el mismo certificado y cambia el row.id, perdemos el override de macrotabla?"
> **Domain expert:** "No deberiamos. El override debe reatarse por lineage estable; si no puede probarse continuidad, se marca conflicto."

## Flagged ambiguities

- El contrato de trazabilidad esta definido, pero todavia no esta materializado en una entidad de dominio persistida.
- Falta cerrar el canal de visibilidad de impacto para operadores (UI, API y alertas).
- Falta materializar en codigo la funcion deterministica de clasificacion de diffs antes de preview/ejecucion.
- Falta materializar el flujo completo de autorizacion destructiva (snapshot inmutable + token one-shot + expiracion + rol).
- Falta implementar canon de serializacion JSON para snapshot (incluyendo orden estable y normalizacion de listas).
- La especificacion exacta de canonicalizacion queda explicitamente fuera del bloqueo actual de domain model y pendiente de ADR tecnico.
- Falta implementar `lineage_row_key` estable en pipeline OCR y en reconciliacion de reimports.
- Falta desacoplar overrides de macrotabla respecto a `source_row_id` tecnico para preservar continuidad.
- Falta implementar versionado compuesto de calculo (`engine_version`, `rule_pack_version`, `effective_rule_hash`) en snapshots y logs.
- Falta implementar en codigo el modelo operativo de **Recomendaciones** (maquina de estados, UX de aceptacion/rechazo, auditoria).
- Falta materializar parser/validator de `subject_ref = <kind>:<id>[:<scope>]` con versionado de contrato.
- Falta modelar permisos tenant-configurable para aceptar/rechazar recomendaciones blocking sin hardcode de roles.
- Falta implementar expiracion por evento con prioridad sobre timeout en el motor de recomendaciones.
- Falta definir estrategia de retry para recomendaciones `applied -> failed` alineada con policy y supersede por cambio de contexto.
- Falta contrato de **Eventos de Dominio** y su persistencia/publicacion para flujos centrales.
- Falta definicion formal y configurable de **Dato Critico** para detalle de obra.
- "General" queda reservado para la solapa de detalle y el data-flow tenant. Cuando haga falta distinguir, usar **Layout General** para la UI y **Data-flow General** para la configuracion tenant.
- El editor de layout ya usa una grilla persistida, pero falta definir si el contrato de `gridX/gridY/gridH` sera versionado para futuras migraciones visuales.
- Las rutas actuales documentan flujos documentales y data-flow con `supportStatus`; falta decidir cuando un estado `planned` se convierte en compromiso de producto.
- El asistente conversacional persiste conversaciones y herramientas, pero falta cerrar gobernanza de herramientas por rol/capability mas alla de membresia tenant.
