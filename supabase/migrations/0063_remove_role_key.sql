-- Migration to remove role key and use role IDs everywhere
-- This removes the 'key' field from roles and updates calendar_events to use role_id instead of role_key

-- Step 1: Add target_role_id column to calendar_events
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS target_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- Step 2: Migrate existing data from target_role_key to target_role_id
-- Match role_key with roles.key within the same tenant
UPDATE public.calendar_events ce
SET target_role_id = r.id
FROM public.roles r
WHERE ce.target_role_key IS NOT NULL
  AND ce.target_role_key = r.key
  AND ce.tenant_id = r.tenant_id;

-- Step 3: Drop the target_role_key column
ALTER TABLE public.calendar_events
DROP COLUMN IF EXISTS target_role_key;

-- Step 4: Drop the unique constraint on roles (tenant_id, key)
ALTER TABLE public.roles
DROP CONSTRAINT IF EXISTS unique_role_per_tenant;

-- Step 5: Make the key column nullable and set it to NULL for all existing roles
-- We keep the column for now to avoid breaking any remaining references
-- It can be dropped in a future migration after verifying no code uses it
ALTER TABLE public.roles
ALTER COLUMN key DROP NOT NULL;

-- Set all existing keys to NULL since they're no longer used
UPDATE public.roles SET key = NULL;

-- Add a comment explaining the deprecation
COMMENT ON COLUMN public.roles.key IS 'DEPRECATED: This column is no longer used. Role identification is now done via UUID id.';
