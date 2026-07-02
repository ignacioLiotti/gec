-- Generated documents are tenant work products. Any authenticated tenant
-- member can list, open, and correct non-approved generated documents in
-- their active tenant. Private drafts remain owner-scoped in 0107.

DROP POLICY IF EXISTS "generated_documents_select" ON public.generated_documents;
CREATE POLICY "generated_documents_select"
  ON public.generated_documents
  FOR SELECT
  USING (
    public.is_member_of(tenant_id)
  );

DROP POLICY IF EXISTS "generated_documents_update" ON public.generated_documents;
CREATE POLICY "generated_documents_update"
  ON public.generated_documents
  FOR UPDATE
  USING (
    public.has_permission(tenant_id, 'documents:review')
    OR (
      status <> 'APPROVED'
      AND public.is_member_of(tenant_id)
    )
  )
  WITH CHECK (
    public.has_permission(tenant_id, 'documents:review')
    OR (
      status <> 'APPROVED'
      AND public.is_member_of(tenant_id)
    )
  );

DROP POLICY IF EXISTS "generated_document_events_select" ON public.generated_document_events;
CREATE POLICY "generated_document_events_select"
  ON public.generated_document_events
  FOR SELECT
  USING (
    public.is_member_of(tenant_id)
  );

DROP POLICY IF EXISTS "generated_document_events_insert" ON public.generated_document_events;
CREATE POLICY "generated_document_events_insert"
  ON public.generated_document_events
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.generated_documents gd
      WHERE gd.id = generated_document_events.generated_document_id
        AND gd.tenant_id = generated_document_events.tenant_id
        AND (
          public.has_permission(gd.tenant_id, 'documents:review')
          OR (
            gd.status <> 'APPROVED'
            AND public.is_member_of(gd.tenant_id)
          )
        )
    )
  );
