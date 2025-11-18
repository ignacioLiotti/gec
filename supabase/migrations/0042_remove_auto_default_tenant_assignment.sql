-- Remove automatic assignment of new users to default tenant
-- This allows users to be created without automatically being assigned to any tenant
-- Users will need to be explicitly assigned via invitations or onboarding flow

-- Drop the trigger that auto-assigns users to default tenant
DROP TRIGGER IF EXISTS on_profile_created_add_membership ON public.profiles;

-- Optionally drop the function as well (it's no longer needed)
DROP FUNCTION IF EXISTS public.handle_new_profile_membership();

