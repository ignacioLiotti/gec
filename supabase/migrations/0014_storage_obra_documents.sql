-- Create storage bucket for obra documents and permissive auth policies

-- Create bucket if it does not exist (compatible with older local storage versions)
insert into storage.buckets (id, name, public)
values ('obra-documents', 'obra-documents', false)
on conflict (id) do nothing;

-- Policies on storage.objects for this bucket
-- Allow authenticated users to list/read/upload/delete within the bucket
drop policy if exists "obra-documents read" on storage.objects;
create policy "obra-documents read"
  on storage.objects for select
  using (
    bucket_id = 'obra-documents' and auth.role() = 'authenticated'
  );

drop policy if exists "obra-documents insert" on storage.objects;
create policy "obra-documents insert"
  on storage.objects for insert
  with check (
    bucket_id = 'obra-documents' and auth.role() = 'authenticated'
  );

drop policy if exists "obra-documents update" on storage.objects;
create policy "obra-documents update"
  on storage.objects for update
  using (
    bucket_id = 'obra-documents' and auth.role() = 'authenticated'
  );

drop policy if exists "obra-documents delete" on storage.objects;
create policy "obra-documents delete"
  on storage.objects for delete
  using (
    bucket_id = 'obra-documents' and auth.role() = 'authenticated'
  );










