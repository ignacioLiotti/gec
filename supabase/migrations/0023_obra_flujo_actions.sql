-- Create obra_flujo_actions table for configurable completion workflows
CREATE TABLE IF NOT EXISTS obra_flujo_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,

  -- Action configuration
  action_type TEXT NOT NULL CHECK (action_type IN ('email', 'calendar_event')),
  timing_mode TEXT NOT NULL CHECK (timing_mode IN ('immediate', 'offset', 'scheduled')),

  -- Timing details
  offset_value INTEGER, -- numeric value for offset
  offset_unit TEXT CHECK (offset_unit IN ('minutes', 'hours', 'days', 'weeks', 'months')),
  scheduled_date TIMESTAMPTZ, -- specific date/time for scheduled actions

  -- Action content
  title TEXT NOT NULL,
  message TEXT,

  -- Recipients (array of user IDs, current user is always default)
  recipient_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

  -- Tracking
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_obra_flujo_actions_obra_id ON obra_flujo_actions(obra_id);
CREATE INDEX idx_obra_flujo_actions_tenant_id ON obra_flujo_actions(tenant_id);
CREATE INDEX idx_obra_flujo_actions_enabled ON obra_flujo_actions(enabled) WHERE enabled = TRUE;

-- RLS Policies
ALTER TABLE obra_flujo_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view flujo actions for obras in their tenant
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

-- Policy: Users can insert flujo actions for obras in their tenant
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

-- Policy: Users can update flujo actions in their tenant
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

-- Policy: Users can delete flujo actions in their tenant
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

-- Create a table to track executed flujo actions
CREATE TABLE IF NOT EXISTS obra_flujo_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flujo_action_id UUID NOT NULL REFERENCES obra_flujo_actions(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for executions
CREATE INDEX idx_obra_flujo_executions_flujo_action_id ON obra_flujo_executions(flujo_action_id);
CREATE INDEX idx_obra_flujo_executions_obra_id ON obra_flujo_executions(obra_id);
CREATE INDEX idx_obra_flujo_executions_status ON obra_flujo_executions(status);

-- RLS for executions
ALTER TABLE obra_flujo_executions ENABLE ROW LEVEL SECURITY;

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
