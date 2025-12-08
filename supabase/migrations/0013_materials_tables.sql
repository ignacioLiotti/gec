-- Material Orders and Items tables
CREATE TABLE IF NOT EXISTS public.material_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nro_orden TEXT,
  solicitante TEXT,
  gestor TEXT,
  proveedor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.material_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.material_orders(id) ON DELETE CASCADE,
  cantidad NUMERIC NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS material_orders_obra_id_idx ON public.material_orders(obra_id);
CREATE INDEX IF NOT EXISTS material_order_items_order_id_idx ON public.material_order_items(order_id);

-- RLS
ALTER TABLE public.material_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_order_items ENABLE ROW LEVEL SECURITY;

-- Policies: users can manage material orders for obras in their tenant
CREATE POLICY "Users can view material orders from their tenant's obras"
  ON public.material_orders
  FOR SELECT
  USING (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert material orders in their tenant's obras"
  ON public.material_orders
  FOR INSERT
  WITH CHECK (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update material orders in their tenant's obras"
  ON public.material_orders
  FOR UPDATE
  USING (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete material orders in their tenant's obras"
  ON public.material_orders
  FOR DELETE
  USING (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Items policies: inherit via join on order_id
CREATE POLICY "Users can view material items from their tenant's obras"
  ON public.material_order_items
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.material_orders
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert material items from their tenant's obras"
  ON public.material_order_items
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.material_orders
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update material items from their tenant's obras"
  ON public.material_order_items
  FOR UPDATE
  USING (
    order_id IN (
      SELECT id FROM public.material_orders
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete material items from their tenant's obras"
  ON public.material_order_items
  FOR DELETE
  USING (
    order_id IN (
      SELECT id FROM public.material_orders
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  );

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER material_orders_updated_at
  BEFORE UPDATE ON public.material_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER material_order_items_updated_at
  BEFORE UPDATE ON public.material_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();



