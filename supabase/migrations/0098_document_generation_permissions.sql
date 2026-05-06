-- Document generation permissions and tighter RLS for review/admin flows

INSERT INTO public.permissions (key, description, category, display_name, sort_order)
VALUES
  ('nav:document-generation', 'Access to document generation section in navigation', 'navigation', 'Documentos', 50),
  ('documents:create', 'Create generated documents and manage own drafts', 'documents', 'Crear documentos', 0),
  ('documents:review', 'Review, approve and reject generated documents', 'documents', 'Revisar documentos', 1),
  ('documents:templates', 'Manage document templates and configuration', 'documents', 'Administrar plantillas documentales', 2),
  ('documents:drafts:all', 'View drafts created by other users in the tenant', 'documents', 'Ver borradores de todos', 3)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;

INSERT INTO public.role_templates (key, name, description, permissions, is_system)
VALUES
  (
    'document_creator',
    'Document Creator',
    'Can create documents, save drafts, and work inside the document generation flow.',
    '["nav:document-generation", "documents:create"]'::jsonb,
    true
  ),
  (
    'document_reviewer',
    'Document Reviewer',
    'Can review generated documents and approve or reject them.',
    '["nav:document-generation", "documents:review"]'::jsonb,
    true
  ),
  (
    'document_manager',
    'Document Manager',
    'Full document-generation access including drafts, review, and template administration.',
    '["nav:document-generation", "documents:create", "documents:review", "documents:templates", "documents:drafts:all"]'::jsonb,
    true
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

DROP POLICY IF EXISTS "document_generation_templates_select" ON public.document_generation_templates;
CREATE POLICY "document_generation_templates_select"
  ON public.document_generation_templates
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR public.is_member_of(tenant_id)
  );

DROP POLICY IF EXISTS "document_generation_templates_manage" ON public.document_generation_templates;
CREATE POLICY "document_generation_templates_manage"
  ON public.document_generation_templates
  FOR ALL
  USING (
    (tenant_id IS NULL AND public.is_superadmin())
    OR (tenant_id IS NOT NULL AND public.has_permission(tenant_id, 'documents:templates'))
  )
  WITH CHECK (
    (tenant_id IS NULL AND public.is_superadmin())
    OR (tenant_id IS NOT NULL AND public.has_permission(tenant_id, 'documents:templates'))
  );

DROP POLICY IF EXISTS "generated_document_drafts_select" ON public.generated_document_drafts;
CREATE POLICY "generated_document_drafts_select"
  ON public.generated_document_drafts
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.has_permission(tenant_id, 'documents:drafts:all')
  );

DROP POLICY IF EXISTS "generated_document_drafts_manage" ON public.generated_document_drafts;
DROP POLICY IF EXISTS "generated_document_drafts_insert" ON public.generated_document_drafts;
DROP POLICY IF EXISTS "generated_document_drafts_update" ON public.generated_document_drafts;
DROP POLICY IF EXISTS "generated_document_drafts_delete" ON public.generated_document_drafts;

CREATE POLICY "generated_document_drafts_insert"
  ON public.generated_document_drafts
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_permission(tenant_id, 'documents:create')
  );

CREATE POLICY "generated_document_drafts_update"
  ON public.generated_document_drafts
  FOR UPDATE
  USING (
    created_by = auth.uid()
    AND public.has_permission(tenant_id, 'documents:create')
  )
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_permission(tenant_id, 'documents:create')
  );

CREATE POLICY "generated_document_drafts_delete"
  ON public.generated_document_drafts
  FOR DELETE
  USING (
    created_by = auth.uid()
    AND public.has_permission(tenant_id, 'documents:create')
  );

DROP POLICY IF EXISTS "generated_documents_select" ON public.generated_documents;
CREATE POLICY "generated_documents_select"
  ON public.generated_documents
  FOR SELECT
  USING (
    generated_by = auth.uid()
    OR public.has_permission(tenant_id, 'documents:review')
  );

DROP POLICY IF EXISTS "generated_documents_manage" ON public.generated_documents;
DROP POLICY IF EXISTS "generated_documents_insert" ON public.generated_documents;
DROP POLICY IF EXISTS "generated_documents_update" ON public.generated_documents;

CREATE POLICY "generated_documents_insert"
  ON public.generated_documents
  FOR INSERT
  WITH CHECK (
    generated_by = auth.uid()
    AND public.has_permission(tenant_id, 'documents:create')
  );

CREATE POLICY "generated_documents_update"
  ON public.generated_documents
  FOR UPDATE
  USING (
    public.has_permission(tenant_id, 'documents:review')
    OR (
      generated_by = auth.uid()
      AND status <> 'APPROVED'
      AND public.has_permission(tenant_id, 'documents:create')
    )
  )
  WITH CHECK (
    public.has_permission(tenant_id, 'documents:review')
    OR (
      generated_by = auth.uid()
      AND status <> 'APPROVED'
      AND public.has_permission(tenant_id, 'documents:create')
    )
  );

DROP POLICY IF EXISTS "generated_document_events_select" ON public.generated_document_events;
CREATE POLICY "generated_document_events_select"
  ON public.generated_document_events
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.has_permission(tenant_id, 'documents:review')
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
            public.has_permission(gd.tenant_id, 'documents:create')
            AND gd.generated_by = auth.uid()
          )
        )
    )
  );
