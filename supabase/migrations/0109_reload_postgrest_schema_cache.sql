-- Force PostgREST to reload its schema cache after repairing insurance tables.
-- This is safe and idempotent; it does not mutate application data.

notify pgrst, 'reload schema';
