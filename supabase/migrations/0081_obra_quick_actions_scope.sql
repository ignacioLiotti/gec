-- Scope quick actions to either tenant-default (obra_id null) or a specific obra.

ALTER TABLE public.obra_default_quick_actions
  ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'obra_default_quick_actions_name_unique'
      AND table_schema = 'public'
      AND table_name = 'obra_default_quick_actions'
  ) THEN
    ALTER TABLE public.obra_default_quick_actions
      DROP CONSTRAINT obra_default_quick_actions_name_unique;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS obra_default_quick_actions_tenant_default_name_unique
  ON public.obra_default_quick_actions(tenant_id, name)
  WHERE obra_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS obra_default_quick_actions_tenant_obra_name_unique
  ON public.obra_default_quick_actions(tenant_id, obra_id, name)
  WHERE obra_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS obra_default_quick_actions_tenant_obra_idx
  ON public.obra_default_quick_actions(tenant_id, obra_id);
