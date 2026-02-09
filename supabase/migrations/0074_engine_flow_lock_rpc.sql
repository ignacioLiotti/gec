-- RPC functions for flow lock acquire/release.
-- Works around a PostgREST bug where URL-encoded `or` filters
-- on PATCH requests fail with "column does not exist".

CREATE OR REPLACE FUNCTION public.acquire_flow_lock(
  p_instance_id uuid,
  p_lock_token text,
  p_expires_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.flow_instance
  SET lock_token = p_lock_token,
      lock_expires_at = p_expires_at
  WHERE id = p_instance_id
    AND (lock_expires_at IS NULL OR lock_expires_at < now());
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_flow_lock(
  p_instance_id uuid,
  p_lock_token text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.flow_instance
  SET lock_token = NULL,
      lock_expires_at = NULL
  WHERE id = p_instance_id
    AND lock_token = p_lock_token;
END;
$$;
