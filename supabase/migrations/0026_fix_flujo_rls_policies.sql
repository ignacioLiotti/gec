-- Fix RLS policies to avoid stack depth exceeded error
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view flujo actions in their tenant" ON obra_flujo_actions;
DROP POLICY IF EXISTS "Users can create flujo actions in their tenant" ON obra_flujo_actions;
DROP POLICY IF EXISTS "Users can update flujo actions in their tenant" ON obra_flujo_actions;
DROP POLICY IF EXISTS "Users can delete flujo actions in their tenant" ON obra_flujo_actions;
DROP POLICY IF EXISTS "Users can view flujo executions in their tenant" ON obra_flujo_executions;

-- Recreate policies with EXISTS instead of IN to avoid recursion
CREATE POLICY "Users can view flujo actions in their tenant"
  ON obra_flujo_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = obra_flujo_actions.tenant_id
    )
  );

CREATE POLICY "Users can create flujo actions in their tenant"
  ON obra_flujo_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = obra_flujo_actions.tenant_id
    )
  );

CREATE POLICY "Users can update flujo actions in their tenant"
  ON obra_flujo_actions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = obra_flujo_actions.tenant_id
    )
  );

CREATE POLICY "Users can delete flujo actions in their tenant"
  ON obra_flujo_actions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = obra_flujo_actions.tenant_id
    )
  );

CREATE POLICY "Users can view flujo executions in their tenant"
  ON obra_flujo_executions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM obras
      JOIN memberships ON memberships.tenant_id = obras.tenant_id
      WHERE obras.id = obra_flujo_executions.obra_id
      AND memberships.user_id = auth.uid()
    )
  );
