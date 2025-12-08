-- Enable realtime for notifications table (so INSERTs stream to clients)
do $$ begin
  perform 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications';
  if not found then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;










