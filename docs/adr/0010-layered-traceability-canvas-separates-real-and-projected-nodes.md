# Layered traceability canvas separates real and projected nodes

Status: accepted

The obra data-flow visualizer must never hide the difference between dependencies that exist as persisted domain entities and dependencies that are only inferred from reporting or UI consumers. We decided that the graph contract keeps both in one canvas, but every node and edge exposes whether it is `implemented`, `partial`, `planned` or `not_supported`.

This decision also fixes the presentation model:

- the entry point is result-oriented (`view` nodes as visible outcomes)
- the canvas is layered and navigable
- real tables and macrotables remain available even if projected calculations fail
- projected calculations and projected views may degrade independently without taking down the base graph

Why this ADR exists:

- it is hard to reverse once other screens and support workflows depend on the same graph contract
- it would be surprising for a future reader to see "real" and "projected" in the same graph without an explicit rationale
- there was a real trade-off between one homogeneous graph vs. a graph that preserves epistemic honesty

Consequences:

- `/api/obras/:obraId/data-flow-graph` is allowed to return mixed provenance as long as support status is explicit
- the obra visualizer may evolve its UI shell, but it cannot blur or auto-upgrade projected dependencies into "real"
- projected layers must degrade gracefully; they cannot break the base graph of tables and macrotables
