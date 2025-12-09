-- Add workflow_run_id column to track Vercel Workflow runs
-- This allows us to cancel running workflows when rescheduling actions

ALTER TABLE obra_flujo_executions
ADD COLUMN IF NOT EXISTS workflow_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_obra_flujo_executions_workflow_run
ON obra_flujo_executions (workflow_run_id)
WHERE workflow_run_id IS NOT NULL;
