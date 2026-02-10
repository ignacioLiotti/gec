-- Allow duplicate template names when inactive by using partial unique index

ALTER TABLE public.ocr_templates
  DROP CONSTRAINT IF EXISTS ocr_templates_name_unique;

DROP INDEX IF EXISTS public.ocr_templates_name_unique;

CREATE UNIQUE INDEX ocr_templates_name_unique
  ON public.ocr_templates (tenant_id, name)
  WHERE is_active = true;
