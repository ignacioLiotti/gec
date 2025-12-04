create or replace function workflow_insert_notification(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (
    user_id,
    tenant_id,
    title,
    body,
    type,
    action_url,
    pendiente_id,
    data
  ) values (
    (payload->>'user_id')::uuid,
    (payload->>'tenant_id')::uuid,
    payload->>'title',
    payload->>'body',
    payload->>'type',
    payload->>'action_url',
    (payload->>'pendiente_id')::uuid,
    payload->'data'
  );
end;
$$;
