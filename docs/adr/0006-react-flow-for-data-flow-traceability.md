# React Flow for data-flow traceability

Status: accepted

The traceability canvas uses React Flow instead of a custom SVG layout. Nodes represent documents, tables, macrotables, obra fields, calculations and results; edges flow from sources toward the final result; inspectors open from node clicks, while KPI cards only focus the selected result.

React Flow adds a dependency, but it gives stable node rendering, handles, fit-view, minimap/controls and a cleaner path for future interaction than maintaining custom canvas geometry by hand.
