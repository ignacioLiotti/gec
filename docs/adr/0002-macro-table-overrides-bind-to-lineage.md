# Macro table overrides bind to lineage

Status: accepted

Macrotable custom values used to bind to the mutable source row id. We decided to add stable binding fields (`source_tabla_id`, `lineage_row_key`, `binding_status`, `binding_error`) and resolve overrides through stable lineage when available, while retaining legacy row-id fallback during rollout.

This avoids silently losing user edits after OCR reimports. When more than one override maps to the same stable identity and column, the system records a conflict instead of choosing a winner implicitly.
