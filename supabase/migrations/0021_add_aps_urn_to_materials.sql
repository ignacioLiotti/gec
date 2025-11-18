-- Add APS URN field to material_orders for 3D model viewing
ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS aps_urn TEXT;

-- Optional index for URN lookups
CREATE INDEX IF NOT EXISTS material_orders_aps_urn_idx ON public.material_orders(aps_urn);

-- Add comment for documentation
COMMENT ON COLUMN public.material_orders.aps_urn IS 'Autodesk Platform Services URN for 3D model viewing (base64-encoded objectId)';
