-- Document generation creation is baseline tenant-member access.
-- Review and template configuration remain explicit permissions.

DELETE FROM public.user_permission_overrides
WHERE permission_id IN (
  SELECT id
  FROM public.permissions
  WHERE key IN ('nav:document-generation', 'documents:create', 'documents:drafts:all')
);

DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id
  FROM public.permissions
  WHERE key IN ('nav:document-generation', 'documents:create', 'documents:drafts:all')
);

DELETE FROM public.permissions
WHERE key IN ('nav:document-generation', 'documents:create', 'documents:drafts:all');

DELETE FROM public.role_templates
WHERE key = 'document_creator';

UPDATE public.role_templates
SET
  permissions = '["documents:review"]'::jsonb,
  description = 'Can review generated documents and approve or reject them.'
WHERE key = 'document_reviewer';

UPDATE public.role_templates
SET
  permissions = '["documents:review", "documents:templates"]'::jsonb,
  description = 'Full document-generation management access for review and template administration.'
WHERE key = 'document_manager';

DROP POLICY IF EXISTS "generated_document_drafts_select" ON public.generated_document_drafts;
CREATE POLICY "generated_document_drafts_select"
  ON public.generated_document_drafts
  FOR SELECT
  USING (
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "generated_document_drafts_insert" ON public.generated_document_drafts;
CREATE POLICY "generated_document_drafts_insert"
  ON public.generated_document_drafts
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_member_of(tenant_id)
  );

DROP POLICY IF EXISTS "generated_document_drafts_update" ON public.generated_document_drafts;
CREATE POLICY "generated_document_drafts_update"
  ON public.generated_document_drafts
  FOR UPDATE
  USING (
    created_by = auth.uid()
    AND public.is_member_of(tenant_id)
  )
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_member_of(tenant_id)
  );

DROP POLICY IF EXISTS "generated_document_drafts_delete" ON public.generated_document_drafts;
CREATE POLICY "generated_document_drafts_delete"
  ON public.generated_document_drafts
  FOR DELETE
  USING (
    created_by = auth.uid()
    AND public.is_member_of(tenant_id)
  );

DROP POLICY IF EXISTS "generated_documents_select" ON public.generated_documents;
CREATE POLICY "generated_documents_select"
  ON public.generated_documents
  FOR SELECT
  USING (
    generated_by = auth.uid()
    OR public.has_permission(tenant_id, 'documents:review')
  );

DROP POLICY IF EXISTS "generated_documents_insert" ON public.generated_documents;
CREATE POLICY "generated_documents_insert"
  ON public.generated_documents
  FOR INSERT
  WITH CHECK (
    generated_by = auth.uid()
    AND public.is_member_of(tenant_id)
  );

DROP POLICY IF EXISTS "generated_documents_update" ON public.generated_documents;
CREATE POLICY "generated_documents_update"
  ON public.generated_documents
  FOR UPDATE
  USING (
    public.has_permission(tenant_id, 'documents:review')
    OR (
      generated_by = auth.uid()
      AND status <> 'APPROVED'
      AND public.is_member_of(tenant_id)
    )
  )
  WITH CHECK (
    public.has_permission(tenant_id, 'documents:review')
    OR (
      generated_by = auth.uid()
      AND status <> 'APPROVED'
      AND public.is_member_of(tenant_id)
    )
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
            public.is_member_of(gd.tenant_id)
            AND gd.generated_by = auth.uid()
          )
        )
    )
  );
