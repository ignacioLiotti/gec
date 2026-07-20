-- Generated documents can be deleted only by the user who generated them.
-- The API performs tenant-scoped artifact cleanup before deleting the row.

DROP POLICY IF EXISTS "generated_documents_delete" ON public.generated_documents;
CREATE POLICY "generated_documents_delete"
  ON public.generated_documents
  FOR DELETE
  USING (
    generated_by = auth.uid()
    AND public.is_member_of(tenant_id)
  );
