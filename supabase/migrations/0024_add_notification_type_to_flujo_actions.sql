-- Add notification_type field to obra_flujo_actions table
-- Allows calendar events to specify how they should notify users

ALTER TABLE obra_flujo_actions
ADD COLUMN notification_types TEXT[] DEFAULT ARRAY['in_app']::TEXT[];

-- Add constraint to ensure valid notification types
ALTER TABLE obra_flujo_actions
ADD CONSTRAINT valid_notification_types
CHECK (
  notification_types <@ ARRAY['in_app', 'email']::TEXT[] AND
  array_length(notification_types, 1) > 0
);

-- Comment for documentation
COMMENT ON COLUMN obra_flujo_actions.notification_types IS
'Array of notification types for this action: in_app, email, or both';
