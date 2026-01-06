-- Add missing position column to obra_default_tabla_columns if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'obra_default_tabla_columns'
    AND column_name = 'position'
  ) THEN
    ALTER TABLE public.obra_default_tabla_columns
    ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
