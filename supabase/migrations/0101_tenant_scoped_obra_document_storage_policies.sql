-- Restrict obra-documents Storage access to objects whose first path segment
-- is an obra that belongs to the authenticated user's tenant membership.

DROP POLICY IF EXISTS "obra-documents read" ON storage.objects;
DROP POLICY IF EXISTS "obra-documents insert" ON storage.objects;
DROP POLICY IF EXISTS "obra-documents update" ON storage.objects;
DROP POLICY IF EXISTS "obra-documents delete" ON storage.objects;

CREATE POLICY "obra-documents read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'obra-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.obras o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND public.is_member_of(o.tenant_id)
        AND o.deleted_at IS NULL
        AND o.purged_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.obra_document_deletes d
          WHERE d.tenant_id = o.tenant_id
            AND d.obra_id = o.id
            AND d.restored_at IS NULL
            AND d.purged_at IS NULL
            AND (
              d.storage_path = name
              OR (d.item_type = 'folder' AND name LIKE d.storage_path || '/%')
            )
        )
    )
  );

CREATE POLICY "obra-documents insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'obra-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.obras o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND public.is_member_of(o.tenant_id)
        AND o.deleted_at IS NULL
        AND o.purged_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.obra_document_deletes d
          WHERE d.tenant_id = o.tenant_id
            AND d.obra_id = o.id
            AND d.restored_at IS NULL
            AND d.purged_at IS NULL
            AND (
              d.storage_path = name
              OR (d.item_type = 'folder' AND name LIKE d.storage_path || '/%')
            )
        )
    )
  );

CREATE POLICY "obra-documents update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'obra-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.obras o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND public.is_member_of(o.tenant_id)
        AND o.deleted_at IS NULL
        AND o.purged_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.obra_document_deletes d
          WHERE d.tenant_id = o.tenant_id
            AND d.obra_id = o.id
            AND d.restored_at IS NULL
            AND d.purged_at IS NULL
            AND (
              d.storage_path = name
              OR (d.item_type = 'folder' AND name LIKE d.storage_path || '/%')
            )
        )
    )
  )
  WITH CHECK (
    bucket_id = 'obra-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.obras o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND public.is_member_of(o.tenant_id)
        AND o.deleted_at IS NULL
        AND o.purged_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.obra_document_deletes d
          WHERE d.tenant_id = o.tenant_id
            AND d.obra_id = o.id
            AND d.restored_at IS NULL
            AND d.purged_at IS NULL
            AND (
              d.storage_path = name
              OR (d.item_type = 'folder' AND name LIKE d.storage_path || '/%')
            )
        )
    )
  );

CREATE POLICY "obra-documents delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'obra-documents'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.obras o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND public.is_member_of(o.tenant_id)
        AND o.deleted_at IS NULL
        AND o.purged_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.obra_document_deletes d
          WHERE d.tenant_id = o.tenant_id
            AND d.obra_id = o.id
            AND d.restored_at IS NULL
            AND d.purged_at IS NULL
            AND (
              d.storage_path = name
              OR (d.item_type = 'folder' AND name LIKE d.storage_path || '/%')
            )
        )
    )
  );
