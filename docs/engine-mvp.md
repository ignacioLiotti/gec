# Engine MVP v1: Flujo por obra + por periodo

## Alcance (v1)
- Detectar si existe un presupuesto base (via evento o docKind).
- Permitir generar medicion (crear tabla derivada con columnas extra).
- Permitir generar certificado desde medicion.
- Persistir estado del flujo y outputs.
- Soportar mes anterior para acumulados/comparativos basicos (slot reservado).

## No incluido en v1
- Editor visual de templates.
- Comparacion cross-document (distintos docKinds).
- Workflow distribuido en Cloudflare.
- OCR de curva de avance (solo reservar slot).
- Motor generico de n flujos (solo 1 flujo JSON base con arquitectura para generalizar).

## Eventos y estados
Estados de step: `blocked | ready | running | done | failed`.
Eventos MVP:
- `budget_base.marked` (input manual / doc asociado)
- `document.uploaded` (si docKind permitido)
- `measurement.submitted`
- `certificate.generate.requested`
- `job.planned`

## Entidades minimas
- `flow_instance` (obra + definicion JSON)
- `flow_run` (periodo)
- `flow_step_state`
- `flow_event`

## Endpoints MVP
- `GET /api/flows/state?obraId=&period=`
  - Devuelve steps, estado, acciones disponibles, outputs si existen.
- `POST /api/flows/action`
  - Body: `obraId`, `period`, `action`, `payload`
  - Actions: `open_period | mark_budget_base | submit_measurement | generate_certificate`

## Definicion JSON del flujo
```json
{
  "id": "pmc_v1",
  "name": "Presupuesto -> Medicion -> Certificado",
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
```

## Criterios de aceptacion
- Con presupuesto base marcado, medicion pasa a `ready`.
- Con medicion `done`, certificado pasa a `ready`.
- Certificado `ready` y `auto` genera `job.planned`.
- Estado persiste por obra + periodo.
- Eventos idempotentes con `dedupe_key`.
