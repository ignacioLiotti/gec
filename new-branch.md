✅ Definición del MVP (qué hace y qué NO hace)
MVP v1 — “Flujo por obra + por período”
Objetivo: en una obra, para un período (mes), poder:

detectar que existe un Presupuesto base (Excel/CSV importado o extracción existente)

permitir “Generar Medición” (crear una planilla/tabla derivada con columnas extra)

permitir “Generar Certificado” desde esa medición

persistir estado del flujo y outputs

soportar “mes anterior” para acumulados y comparativos básicos

Qué NO entra en v1

editor visual de templates de documentos

comparación cross-document (distintos docKinds)

workflow distribuido en Cloudflare

OCR de curva de avance (solo reservar el slot)

motor genérico de n flujos (solo 1 flujo JSON base, pero con arquitectura para generalizar)

0. Documento inicial (antes de codear)
   Creá un doc de una página (en el repo) para alinear todo.
   📄 docs/engine-mvp.md
   Incluí:

alcance del MVP v1

eventos y estados

entidades mínimas

endpoints

“definition JSON” del flujo presupuesto→medición→certificado

criterios de aceptación

✅ Esto te evita re-trabajo.

1. Carpeta lib/engine + API pública mínima
   1.1 Estructura de carpetas (creala tal cual)
   /lib/engine
   index.ts # API pública (lo único importable)
   /core
   types.ts
   definition.ts
   evaluator.ts
   planner.ts
   /runtime
   runtime.ts
   locks.ts
   idempotency.ts
   /adapters
   db.ts
   storage.ts
   /flows
   presupuesto-medicion-certificado.flow.json

Qué vas a exportar desde lib/engine/index.ts (MVP)

emitEvent(obraId, event)

evaluate(obraId, period?)

getFlowState(obraId)

initFlowInstance(obraId, flowDefinitionIdOrJson)

✅ Regla: todo el resto es “privado”.

2. Modelo de datos mínimo (DB)
   No hace falta hacer 10 tablas, pero sí necesitás persistir estado.
   Tablas mínimas (MVP)

flow_instance

id

obra_id

flow_definition_id (string)

definition_json (jsonb) ← para empezar fácil sin panel de configs

created_at

flow_run

id

instance_id

period (string tipo 2026-03)

status (active|archived)

created_at

flow_step_state

id

run_id

step_id (string)

status (blocked|ready|running|done|failed)

reason (text/json)

inputs_json (jsonb)

outputs_json (jsonb)

updated_at

flow_event

id

obra_id

run_id (nullable si evento global)

type

payload_json

dedupe_key

created_at

Si querés hacerlo ultra simple: flow_step_state podría ir todo en un jsonb por run. Pero yo prefiero normalizado porque te facilita UI y queries.

3. Definición del flujo en JSON (primera configuración)
   📄 lib/engine/flows/presupuesto-medicion-certificado.flow.json
   Lo mantenés simple:

steps humanos vs automáticos

inputs requeridos

outputs esperados

Ejemplo conceptual (muy MVP):
{
"id": "pmc_v1",
"name": "Presupuesto → Medición → Certificado",
"runKey": "period",
"steps": [
{
"id": "budget_base",
"type": "input",
"required": true,
"docKinds": ["budget_excel", "budget_pdf_extracted"]
},
{
"id": "measurement",
"type": "generate",
"requires": ["budget_base"],
"outputs": ["measurement_table"],
"mode": "human_input"
},
{
"id": "certificate",
"type": "generate",
"requires": ["measurement"],
"outputs": ["certificate_pdf", "certificate_xlsx"],
"mode": "auto"
}
]
}

✅ Nota: después lo evolucionás a “nodes DAG”. Para MVP, “steps lineales” funciona.

4. Engine core v1: evaluator + planner
   4.1 core/types.ts
   Definí tipos:

FlowDefinition

FlowRun

StepState

EngineEvent

4.2 core/evaluator.ts
Función principal:

input: definition + currentStepStates + availableInputs

output: nextStepStates (qué está ready/blocked)

Reglas MVP

budget_base está DONE si existe un doc con docKind permitido “asociado a esa obra”

measurement está READY si budget_base done

certificate está READY si measurement done

4.3 core/planner.ts
Decide si se crean “jobs” automáticos:

si certificate está READY y es auto → planificar job:generate_certificate

En MVP, measurement es “human_input”, entonces no crea job.

5. Runtime v1: eventos + evaluate + persistencia
   5.1 runtime/runtime.ts

emitEvent(obraId, runId?, type, payload, dedupeKey)

evaluate(obraId, period):

lock por obra

asegurar flow_instance

asegurar flow_run(period)

cargar step states actuales

detectar inputs disponibles (adapter)

correr evaluator → nuevos estados

persistir estados

si planner devuelve jobs → encolar/crear job (MVP: solo “marcar para ejecutar”)

5.2 runtime/locks.ts

DB advisory lock por obraId (o SELECT ... FOR UPDATE sobre flow_instance)

clave: que dos evaluate no corran en paralelo

5.3 runtime/idempotency.ts

dedupe_key unique en flow_event

emitEvent no duplica

6. Adapters (acoplarte a lo que ya tenés)
   6.1 adapters/db.ts
   CRUD:

get/create flow_instance

get/create flow_run

get/set step_state

insert event

(opcional) create job record

6.2 adapters/storage.ts
No hace falta para MVP si solo generás XLSX/PDF desde data.
Pero sí conviene:

saveGeneratedDoc(obraId, path, bytes) o usando tu file-manager actual

6.3 “Adapter de inputs” (MUY IMPORTANTE)
En MVP, el engine necesita saber:

¿existe presupuesto base?

Entonces implementás algo como:

findBudgetBaseDoc(obraId):

si ya tenés carpetas de “extracción” o metadatos docKind, buscá ahí

si no: al menos un campo manual “marcar como presupuesto base” (te lo recomiendo)

Esto no reestructura nada: solo una consulta a lo que ya guardás.

7. Endpoints mínimos (MVP)
   No los hagas genéricos todavía. Hacelos “producto”.
   7.1 GET /api/flows/state?obraId=&period=
   Devuelve:

steps + status + reason + acciones disponibles

outputs si existen (links)

7.2 POST /api/flows/action
Body:

obraId

period

action: open_period | mark_budget_base | submit_measurement | generate_certificate

payload

Adentro llama:

emitEvent(...)

evaluate(...)

✅ Ventaja: el front no aprende “eventos”. Aprende “acciones”.

8. UI dentro de GEC (primera pantalla que lo consume)
   Dentro de tu tab Flujos (que ya existe), agregás un panel:
   Panel “Certificación mensual”

selector de período (mes)

lista de steps con estado:

Presupuesto base ✅/⚠️

Medición (pendiente / completada)

Certificado (generado / listo para generar)

botones:

“Marcar documento como presupuesto base”

“Generar medición”

“Generar certificado”

“Ver output”

Importante: para MVP, la “medición” puede ser una tabla simple (aunque sea JSON) editable en UI.

9. Tests clave (te van a salvar)
   9.1 Unit tests del core (sin DB)

evaluator:

sin presupuesto → measurement blocked

con presupuesto → measurement ready

con medición done → certificate ready

planner:

certificate ready → crea job generate

✅ Esto te da confianza sin tocar Supabase.
9.2 Integration test “happy path”
Simulás:

init flow instance

emit document.uploaded (budget)

evaluate → measurement READY

emit measurement.submitted

evaluate → certificate READY

run job generate → output creado

9.3 Idempotencia

emit mismo evento con same dedupe_key dos veces → no duplica states ni jobs

9.4 Concurrencia (mínimo)

dos evaluate simultáneos → solo uno aplica cambios (lock)

10. Etapas recomendadas (para que no te disperses)
    Etapa 1 — “Engine skeleton” (sin UI)
    ✅ Carpeta lib/engine
    ✅ tablas mínimas
    ✅ evaluator/planner
    ✅ endpoints state/action
    ✅ test unitario del core
    Criterio de éxito: desde Postman o curl podés ver el estado del flujo por obra+period.

Etapa 2 — “Integración con documentos reales”
✅ detectar presupuesto base desde tu data real
✅ evento document.uploaded engancha evaluate
✅ step 1 se completa solo cuando el doc existe
Criterio de éxito: subís presupuesto y el flujo se destraba.

Etapa 3 — “Medición editable (MVP simple)”
✅ al apretar “Generar medición”, crear tabla con ítems del presupuesto
✅ UI para cargar % o cantidad
✅ evento measurement.submitted
Criterio de éxito: el usuario completa medición y se habilita certificado.

Etapa 4 — “Generar certificado (output real)”
✅ job auto que genera:

XLSX (desde tabla)

PDF (opcional al inicio; o solo XLSX)

✅ guardar outputs en Documents con badge “Generado”
Criterio de éxito: certificado aparece como archivo generado y queda linkeado al período.

Etapa 5 — “Histórico vs mes anterior”
✅ engine resuelve prevPeriod
✅ summary simple:

avance prev

avance mes

avance total

✅ se inyecta al certificado
Criterio de éxito: período N usa datos de N-1.

11. Sobre “generador de nodos/configs”
    Sí: esto te conviene, pero no lo metas en el MVP.
    Lo que sí hacé YA es:

que el engine cargue definición desde JSON (definition_json)

y que puedas guardar esa definición por obra (flow_instance.definition_json)

Después, el “generador” será una UI o wizard que construye ese JSON.
MVP del generador

un template selector:

“Presupuesto→Medición→Certificado”

botón “Aplicar a esta obra”

guarda el JSON en flow_instance

Checklist de “qué archivos crear” (orden exacto)

docs/engine-mvp.md

lib/engine/index.ts

lib/engine/core/types.ts

lib/engine/core/definition.ts

lib/engine/core/evaluator.ts

lib/engine/core/planner.ts

lib/engine/runtime/runtime.ts

lib/engine/runtime/locks.ts

lib/engine/runtime/idempotency.ts

lib/engine/adapters/db.ts

lib/engine/flows/presupuesto-medicion-certificado.flow.json

app/api/flows/state/route.ts

app/api/flows/action/route.ts

tests: lib/engine/core/\*.test.ts

Si querés, el siguiente paso (y te lo puedo dejar listo en formato copy/paste) es:

el contenido inicial de types.ts, evaluator.ts, runtime.ts

y el JSON final del flujo PMC v1

más el contrato exacto del endpoint /api/flows/state

Decime si estás usando Supabase client server-side con algún wrapper ya (ej: createServerClient) y lo adapto a tus helpers actuales.
