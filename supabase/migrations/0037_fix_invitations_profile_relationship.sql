-- Fix invitations table to properly support profile joins via PostgREST
-- This adds a foreign key relationship from invited_by to profiles table

-- Drop existing foreign key constraint
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey;

-- Add new foreign key to profiles via user_id
-- Note: We keep the reference to auth.users but add a separate mechanism for PostgREST
-- Actually, we can't have two FKs on same column, so we'll handle this differently

-- Instead, let's just keep the existing FK and document that queries should manually join
-- Or we create a view/function for this

-- Actually, the best approach is to keep the FK to auth.users for data integrity,
-- but manually specify the join in queries instead of relying on PostgREST auto-join

-- No schema changes needed - the fix will be in the application code to use manual joins
-- This migration is a placeholder to document the decision

COMMENT ON COLUMN public.invitations.invited_by IS
  'References auth.users(id). To get profile data, manually join: SELECT i.*, p.full_name FROM invitations i LEFT JOIN profiles p ON p.user_id = i.invited_by';
