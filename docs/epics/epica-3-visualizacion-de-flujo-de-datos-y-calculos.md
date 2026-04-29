# Epica 3 - Visualizacion de flujo de datos, calculos y vistas en una obra

Estado de corte: base implementada con grafo real + projected degradable.

## Objetivo

Mostrar de forma navegable como los datos de una obra fluyen desde tablas reales hacia calculos, macrotablas y vistas finales.

## Entregables materializados

- Ruta standalone: `/excel/[obraId]/data-flow`
- Endpoint: `/api/obras/[id]/data-flow-graph`
- Barra de resultados / vistas
- Canvas por capas
- Inspector flotante
- Drilldown de tabla con filas reales y documentos reales
- Preview de documento con signed URL

## Contrato actual

- `implemented`
  - tablas de obra
  - macrotablas reales
  - relaciones tabla -> macrotabla
  - drilldown tabla -> filas/documentos
- `partial`
  - calculos projected desde reporting
  - vistas projected desde consumers reales
- `planned`
  - calculos como entidad persistida general
  - eventos de dominio persistidos dentro del grafo

## Regla de producto vigente

La capa projected nunca puede romper la capa real. Si falla reporting, el usuario sigue viendo tablas/macrotablas reales y el sistema expone la degradacion de cobertura.
