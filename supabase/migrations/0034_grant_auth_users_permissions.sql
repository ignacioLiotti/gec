-- Grant SELECT permission on auth.users to authenticated users
-- This is needed for foreign key validation on the invitations table

-- Grant SELECT permission on auth.users to authenticated users
-- This allows foreign key validation for invitations table and other user references

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
