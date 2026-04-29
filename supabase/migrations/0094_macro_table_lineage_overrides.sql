ALTER TABLE public.macro_table_custom_values
  ADD COLUMN IF NOT EXISTS source_tabla_id UUID NULL REFERENCES public.obra_tablas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS lineage_row_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS binding_status TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS binding_error JSONB NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'macro_table_custom_values_binding_status_check'
  ) THEN
    ALTER TABLE public.macro_table_custom_values
      ADD CONSTRAINT macro_table_custom_values_binding_status_check
      CHECK (binding_status IN ('legacy', 'stable', 'conflict'));
  END IF;
END $$;

UPDATE public.macro_table_custom_values
SET binding_status = 'legacy'
WHERE binding_status IS NULL;

WITH deterministic_binding AS (
  SELECT
    cv.id,
    row.tabla_id,
    row.lineage_row_key
  FROM public.macro_table_custom_values cv
  JOIN public.obra_tabla_rows row
    ON row.id = cv.source_row_id
  WHERE row.tabla_id IS NOT NULL
    AND row.lineage_row_key IS NOT NULL
)
UPDATE public.macro_table_custom_values cv
SET
  source_tabla_id = deterministic_binding.tabla_id,
  lineage_row_key = deterministic_binding.lineage_row_key,
  binding_status = CASE
    WHEN cv.binding_status = 'conflict' THEN cv.binding_status
    ELSE 'stable'
  END,
  binding_error = CASE
    WHEN cv.binding_status = 'conflict' THEN cv.binding_error
    ELSE NULL
  END
FROM deterministic_binding
WHERE cv.id = deterministic_binding.id;

WITH duplicated_binding AS (
  SELECT
    macro_table_id,
    source_tabla_id,
    lineage_row_key,
    column_id,
    array_agg(id ORDER BY updated_at DESC, created_at DESC, id ASC) AS candidate_ids
  FROM public.macro_table_custom_values
  WHERE source_tabla_id IS NOT NULL
    AND lineage_row_key IS NOT NULL
  GROUP BY macro_table_id, source_tabla_id, lineage_row_key, column_id
  HAVING COUNT(*) > 1
)
UPDATE public.macro_table_custom_values cv
SET
  binding_status = 'conflict',
  binding_error = jsonb_build_object(
    'errorCode', 'LINEAGE_OVERRIDE_REATTACH_CONFLICT',
    'detail', 'Multiple overrides map to the same stable lineage identity.',
    'candidateOverrideIds', duplicated_binding.candidate_ids
  )
FROM duplicated_binding
WHERE cv.macro_table_id = duplicated_binding.macro_table_id
  AND cv.source_tabla_id = duplicated_binding.source_tabla_id
  AND cv.lineage_row_key = duplicated_binding.lineage_row_key
  AND cv.column_id = duplicated_binding.column_id;

CREATE INDEX IF NOT EXISTS macro_table_custom_values_source_tabla_idx
  ON public.macro_table_custom_values(source_tabla_id);

CREATE INDEX IF NOT EXISTS macro_table_custom_values_binding_idx
  ON public.macro_table_custom_values(macro_table_id, source_tabla_id, lineage_row_key, column_id);

CREATE UNIQUE INDEX IF NOT EXISTS macro_table_custom_values_stable_unique
  ON public.macro_table_custom_values(macro_table_id, source_tabla_id, lineage_row_key, column_id)
  WHERE binding_status = 'stable'
    AND source_tabla_id IS NOT NULL
    AND lineage_row_key IS NOT NULL;
