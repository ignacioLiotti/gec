# Base KPIs are builder results

Status: accepted

Contrato + ampliaciones, Certificado a la fecha, Saldo a certificar and Porcentaje de avance are represented as seed calculations/results in the data-flow builder, not as special-case view nodes. They can use obra fields, table aggregates, and formula inputs, appear in the editor, participate in formulas and render through the same traceability graph as custom results.

This is deliberately more explicit than hardcoded dashboard widgets. Future formulas can depend on these results, and the canvas can explain them through the same document/table/field/calculation/result vocabulary.

Certificate-derived KPIs are owned by data-flow when configured: Certificado a la fecha reads the latest valid `PMC Resumen.monto_acumulado` ordered by `fecha_certificacion`, then `periodo`, then row creation time. Saldo a certificar and Porcentaje de avance are formulas over that calculated certificate and Contrato + ampliaciones. The seeded writeback mode for these three fields is `suggest`, and repeated recomputes skip already-pending identical suggestions.
