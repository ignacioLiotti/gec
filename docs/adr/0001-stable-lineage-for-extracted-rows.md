# Stable lineage for extracted rows

Status: accepted

OCR and spreadsheet imports create technical row materializations whose `row.id` can change after reimport. We decided that business continuity must be represented by `lineage_row_key`, with `extraction_id`, `materialization_version`, `file_fingerprint` and `content_fingerprint_normalized` as supporting evidence, so downstream consumers can distinguish a new materialization from a new business entity.

Considered options were to keep using `row.id`, to dedupe only by file hash, or to derive a hybrid stable key. The hybrid approach is more work, but it protects macrotable overrides, audit trails and future calculation explainability when documents are reprocessed.
