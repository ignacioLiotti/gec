-- Track scheduled workflow executions for flujo actions
ALTER TABLE obra_flujo_executions
ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES auth.users(id);

ALTER TABLE obra_flujo_executions
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

ALTER TABLE obra_flujo_executions
ADD COLUMN IF NOT EXISTS notification_types TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE obra_flujo_executions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill new columns with sensible defaults
UPDATE obra_flujo_executions
SET scheduled_for = executed_at
WHERE scheduled_for IS NULL;

UPDATE obra_flujo_executions
SET notification_types = ARRAY[]::TEXT[]
WHERE notification_types IS NULL;

CREATE INDEX IF NOT EXISTS idx_obra_flujo_executions_recipient
ON obra_flujo_executions (recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_obra_flujo_executions_scheduled
ON obra_flujo_executions (scheduled_for);

-- Keep updated_at current
DROP TRIGGER IF EXISTS obra_flujo_executions_updated_at ON obra_flujo_executions;
CREATE TRIGGER obra_flujo_executions_updated_at
  BEFORE UPDATE ON obra_flujo_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
