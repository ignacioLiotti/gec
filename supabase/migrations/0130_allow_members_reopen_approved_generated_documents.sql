-- Any tenant member can correct an approved generated document, but only
-- reviewers may leave the resulting row approved. The regeneration route
-- persists member edits as UNDER_REVIEW.

DROP POLICY IF EXISTS "generated_documents_update" ON public.generated_documents;
CREATE POLICY "generated_documents_update"
  ON public.generated_documents
  FOR UPDATE
  USING (
    public.has_permission(tenant_id, 'documents:review')
    OR public.is_member_of(tenant_id)
  )
  WITH CHECK (
    public.has_permission(tenant_id, 'documents:review')
    OR (
      status <> 'APPROVED'
      AND public.is_member_of(tenant_id)
    )
  );
