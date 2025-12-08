-- Optimize RLS policies to prevent stack depth exceeded errors
-- Replace nested IN subqueries with efficient is_member_of() function calls
-- This migration updates obras, certificates, material_orders, material_order_items, and aps_models

-- ============================================================================
-- 1. Update obras table RLS policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view obras from their tenant" ON public.obras;
DROP POLICY IF EXISTS "Users can insert obras in their tenant" ON public.obras;
DROP POLICY IF EXISTS "Users can update obras in their tenant" ON public.obras;
DROP POLICY IF EXISTS "Users can delete obras in their tenant" ON public.obras;

CREATE POLICY "Users can view obras from their tenant"
  ON public.obras
  FOR SELECT
  USING (public.is_member_of(tenant_id));

CREATE POLICY "Users can insert obras in their tenant"
  ON public.obras
  FOR INSERT
  WITH CHECK (public.is_member_of(tenant_id));

CREATE POLICY "Users can update obras in their tenant"
  ON public.obras
  FOR UPDATE
  USING (public.is_member_of(tenant_id));

CREATE POLICY "Users can delete obras in their tenant"
  ON public.obras
  FOR DELETE
  USING (public.is_member_of(tenant_id));

-- ============================================================================
-- 2. Update certificates table RLS policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view certificates from their tenant's obras" ON public.certificates;
DROP POLICY IF EXISTS "Users can insert certificates in their tenant's obras" ON public.certificates;
DROP POLICY IF EXISTS "Users can update certificates in their tenant's obras" ON public.certificates;
DROP POLICY IF EXISTS "Users can delete certificates in their tenant's obras" ON public.certificates;

-- More efficient: check tenant_id via obra instead of nested subqueries
CREATE POLICY "Users can view certificates from their tenant's obras"
  ON public.certificates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = certificates.obra_id
        AND public.is_member_of(obras.tenant_id)
    )
  );

CREATE POLICY "Users can insert certificates in their tenant's obras"
  ON public.certificates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = certificates.obra_id
        AND public.is_member_of(obras.tenant_id)
    )
  );

CREATE POLICY "Users can update certificates in their tenant's obras"
  ON public.certificates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = certificates.obra_id
        AND public.is_member_of(obras.tenant_id)
    )
  );

CREATE POLICY "Users can delete certificates in their tenant's obras"
  ON public.certificates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = certificates.obra_id
        AND public.is_member_of(obras.tenant_id)
    )
  );

-- ============================================================================
-- 3. Update material_orders table RLS policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view material orders from their tenant's obras" ON public.material_orders;
DROP POLICY IF EXISTS "Users can insert material orders in their tenant's obras" ON public.material_orders;
DROP POLICY IF EXISTS "Users can update material orders in their tenant's obras" ON public.material_orders;
DROP POLICY IF EXISTS "Users can delete material orders in their tenant's obras" ON public.material_orders;

CREATE POLICY "Users can view material orders from their tenant's obras"
  ON public.material_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = material_orders.obra_id
        AND public.is_member_of(obras.tenant_id)
    )
  );

CREATE POLICY "Users can insert material orders in their tenant's obras"
  ON public.material_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = material_orders.obra_id
        AND public.is_member_of(obras.tenant_id)
    )
  );

CREATE POLICY "Users can update material orders in their tenant's obras"
  ON public.material_orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = material_orders.obra_id
        AND public.is_member_of(obras.tenant_id)
    )
  );

CREATE POLICY "Users can delete material orders in their tenant's obras"
  ON public.material_orders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      WHERE obras.id = material_orders.obra_id
        AND public.is_member_of(obras.tenant_id)
    )
  );

-- ============================================================================
-- 4. Update material_order_items table RLS policies
-- ============================================================================
-- These are the most deeply nested - they go through material_orders AND obras
-- We'll optimize by joining directly to obras through material_orders
DROP POLICY IF EXISTS "Users can view material items from their tenant's obras" ON public.material_order_items;
DROP POLICY IF EXISTS "Users can insert material items from their tenant's obras" ON public.material_order_items;
DROP POLICY IF EXISTS "Users can update material items from their tenant's obras" ON public.material_order_items;
DROP POLICY IF EXISTS "Users can delete material items from their tenant's obras" ON public.material_order_items;

CREATE POLICY "Users can view material items from their tenant's obras"
  ON public.material_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.material_orders mo
      JOIN public.obras o ON o.id = mo.obra_id
      WHERE mo.id = material_order_items.order_id
        AND public.is_member_of(o.tenant_id)
    )
  );

CREATE POLICY "Users can insert material items from their tenant's obras"
  ON public.material_order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.material_orders mo
      JOIN public.obras o ON o.id = mo.obra_id
      WHERE mo.id = material_order_items.order_id
        AND public.is_member_of(o.tenant_id)
    )
  );

CREATE POLICY "Users can update material items from their tenant's obras"
  ON public.material_order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.material_orders mo
      JOIN public.obras o ON o.id = mo.obra_id
      WHERE mo.id = material_order_items.order_id
        AND public.is_member_of(o.tenant_id)
    )
  );

CREATE POLICY "Users can delete material items from their tenant's obras"
  ON public.material_order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.material_orders mo
      JOIN public.obras o ON o.id = mo.obra_id
      WHERE mo.id = material_order_items.order_id
        AND public.is_member_of(o.tenant_id)
    )
  );

-- ============================================================================
-- 5. Update aps_models table RLS policies (if it exists)
-- ============================================================================
-- Check if the table exists and update its policies
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'aps_models') THEN
    -- Drop old policies
    DROP POLICY IF EXISTS "Users can view APS models from their obras" ON public.aps_models;
    DROP POLICY IF EXISTS "Users can insert APS models for their obras" ON public.aps_models;
    DROP POLICY IF EXISTS "Users can update APS models from their obras" ON public.aps_models;
    DROP POLICY IF EXISTS "Users can delete APS models from their obras" ON public.aps_models;

    -- Create new optimized policies
    EXECUTE '
      CREATE POLICY "Users can view APS models from their obras"
        ON public.aps_models
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.obras
            WHERE obras.id = aps_models.obra_id
              AND public.is_member_of(obras.tenant_id)
          )
        )
    ';

    EXECUTE '
      CREATE POLICY "Users can insert APS models for their obras"
        ON public.aps_models
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.obras
            WHERE obras.id = aps_models.obra_id
              AND public.is_member_of(obras.tenant_id)
          )
        )
    ';

    EXECUTE '
      CREATE POLICY "Users can update APS models from their obras"
        ON public.aps_models
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.obras
            WHERE obras.id = aps_models.obra_id
              AND public.is_member_of(obras.tenant_id)
          )
        )
    ';

    EXECUTE '
      CREATE POLICY "Users can delete APS models from their obras"
        ON public.aps_models
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.obras
            WHERE obras.id = aps_models.obra_id
              AND public.is_member_of(obras.tenant_id)
          )
        )
    ';
  END IF;
END $$;

-- Add helpful comment
COMMENT ON FUNCTION public.is_member_of(UUID) IS
  'Efficiently checks if current user is a member of the given tenant. Used in RLS policies to avoid stack depth errors from nested subqueries.';
