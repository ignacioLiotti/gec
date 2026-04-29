# Epica 2 - Editor global de flujos documentales del tenant

Estado de corte: implementado como base operativa, con comparacion adicional `document-flows-2`.

## Objetivo

Permitir que un admin del tenant gobierne el contrato documental comun:

- carpetas
- tipos documentales
- prompts/campos
- tablas destino
- macrotablas downstream

## Entregables materializados

- Ruta admin principal: `/admin/document-flows`
- Ruta comparativa literal al handoff: `/admin/document-flows-2`
- Persistencia sobre `/api/obra-defaults`
- Lectura de macrotablas reales y templates OCR reales
- Inspector flotante editable para:
  - carpeta
  - tabla destino
  - campo extraido
- Macrotablas expuestas como downstream read-only

## Soporte actual

- `implemented`
  - carpeta como contrato tenant
  - tabla destino
  - campo extraido
  - save real del contrato
- `partial`
  - wiring fino campo -> columna -> macrotabla
  - consumo final / vistas
- `planned`
  - publicacion formal/versionado del flujo
  - reglas de materializacion avanzadas

## Regla de producto vigente

La carpeta no se modela como un mero path de storage. Se trata como un contrato documental del tenant que define como se interpreta la carga futura y como impacta tablas/macrotablas.
