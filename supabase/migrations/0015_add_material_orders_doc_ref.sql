-- Add persistent reference to uploaded document for material orders
ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS doc_bucket TEXT,
  ADD COLUMN IF NOT EXISTS doc_path TEXT;

-- Optional index to look up by path
CREATE INDEX IF NOT EXISTS material_orders_doc_path_idx ON public.material_orders(doc_path);









