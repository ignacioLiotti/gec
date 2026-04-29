# Base KPIs are builder results

Status: accepted

Contrato + ampliaciones, Certificado a la fecha, Saldo a certificar and Porcentaje de avance are represented as seed calculations/results in the data-flow builder, not as special-case view nodes. They can use obra fields as formula inputs, appear in the editor, participate in formulas and render through the same traceability graph as custom results.

This is deliberately more explicit than hardcoded dashboard widgets. Future formulas can depend on these results, and the canvas can explain them through the same document/table/field/calculation/result vocabulary.
