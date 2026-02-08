-- Add lock columns for engine flow instance
ALTER TABLE public.flow_instance
  ADD COLUMN IF NOT EXISTS lock_token TEXT,
  ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;
