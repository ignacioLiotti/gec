CREATE TABLE IF NOT EXISTS public.document_generation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL,
  target_folder_path TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  schema JSONB NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  content_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_generation_templates_tenant_key_version_idx
  ON public.document_generation_templates(tenant_id, key, version)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS document_generation_templates_system_key_version_idx
  ON public.document_generation_templates(key, version)
  WHERE tenant_id IS NULL AND is_system = TRUE;

CREATE INDEX IF NOT EXISTS document_generation_templates_lookup_idx
  ON public.document_generation_templates(document_type, status, target_folder_path);

CREATE TABLE IF NOT EXISTS public.generated_document_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  folder_path TEXT NOT NULL,
  document_type TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.document_generation_templates(id) ON DELETE RESTRICT,
  template_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY_TO_GENERATE', 'CANCELLED')),
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_document_drafts_obra_idx
  ON public.generated_document_drafts(obra_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS generated_document_drafts_template_idx
  ON public.generated_document_drafts(template_id);

CREATE TABLE IF NOT EXISTS public.generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  folder_path TEXT NOT NULL,
  document_type TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.document_generation_templates(id) ON DELETE RESTRICT,
  template_version INTEGER NOT NULL,
  source_draft_id UUID REFERENCES public.generated_document_drafts(id) ON DELETE SET NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'obra-documents',
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED')),
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_documents_obra_idx
  ON public.generated_documents(obra_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS generated_documents_status_idx
  ON public.generated_documents(status, document_type);

CREATE TABLE IF NOT EXISTS public.generated_document_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_document_id UUID NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_document_events_document_idx
  ON public.generated_document_events(generated_document_id, created_at DESC);

ALTER TABLE public.document_generation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_document_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_document_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_generation_templates_select" ON public.document_generation_templates;
CREATE POLICY "document_generation_templates_select"
  ON public.document_generation_templates
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "document_generation_templates_manage" ON public.document_generation_templates;
CREATE POLICY "document_generation_templates_manage"
  ON public.document_generation_templates
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "generated_document_drafts_select" ON public.generated_document_drafts;
CREATE POLICY "generated_document_drafts_select"
  ON public.generated_document_drafts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.obras o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = generated_document_drafts.obra_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "generated_document_drafts_manage" ON public.generated_document_drafts;
CREATE POLICY "generated_document_drafts_manage"
  ON public.generated_document_drafts
  FOR ALL
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.obras o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = generated_document_drafts.obra_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.obras o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = generated_document_drafts.obra_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "generated_documents_select" ON public.generated_documents;
CREATE POLICY "generated_documents_select"
  ON public.generated_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.obras o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = generated_documents.obra_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "generated_documents_manage" ON public.generated_documents;
CREATE POLICY "generated_documents_manage"
  ON public.generated_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.obras o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = generated_documents.obra_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.obras o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = generated_documents.obra_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "generated_document_events_select" ON public.generated_document_events;
CREATE POLICY "generated_document_events_select"
  ON public.generated_document_events
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "generated_document_events_insert" ON public.generated_document_events;
CREATE POLICY "generated_document_events_insert"
  ON public.generated_document_events
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS document_generation_templates_updated_at ON public.document_generation_templates;
CREATE TRIGGER document_generation_templates_updated_at
  BEFORE UPDATE ON public.document_generation_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS generated_document_drafts_updated_at ON public.generated_document_drafts;
CREATE TRIGGER generated_document_drafts_updated_at
  BEFORE UPDATE ON public.generated_document_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS generated_documents_updated_at ON public.generated_documents;
CREATE TRIGGER generated_documents_updated_at
  BEFORE UPDATE ON public.generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

INSERT INTO public.document_generation_templates (
  tenant_id,
  key,
  name,
  description,
  document_type,
  target_folder_path,
  version,
  schema,
  content_html,
  status,
  is_system
)
VALUES
  (
    NULL,
    'certificate-default',
    'Certificado Operativo',
    'Plantilla base para certificados emitidos por obra.',
    'CERTIFICATE',
    'certificados',
    1,
    '{
      "fields": [
        {"key":"title","label":"Titulo","type":"text","required":true,"defaultValue":"Certificado de obra"},
        {"key":"certificateNumber","label":"Numero","type":"text","required":true},
        {"key":"issueDate","label":"Fecha de emision","type":"date","required":true},
        {"key":"period","label":"Periodo","type":"text","required":true},
        {"key":"expedient","label":"Expediente","type":"text","required":false},
        {"key":"amount","label":"Monto","type":"money","required":true},
        {"key":"notes","label":"Observaciones","type":"textarea","required":false}
      ]
    }'::jsonb,
    '<main style="font-family: Arial, sans-serif; color: #1f2937; padding: 32px;">
      <header style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px;">
        <div>
          <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;">Documento generado</p>
          <h1 style="margin:8px 0 0;font-size:28px;">{{title}}</h1>
        </div>
        <div style="text-align:right;font-size:14px;">
          <div><strong>Obra:</strong> {{workName}}</div>
          <div><strong>Numero:</strong> {{certificateNumber}}</div>
          <div><strong>Fecha:</strong> {{issueDate}}</div>
        </div>
      </header>
      <section style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:24px;">
        <article style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;">Periodo</p>
          <p style="margin:0;font-size:20px;font-weight:600;">{{period}}</p>
        </article>
        <article style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;">Monto</p>
          <p style="margin:0;font-size:20px;font-weight:600;">{{amount}}</p>
        </article>
      </section>
      <section style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;">Expediente</p>
        <p style="margin:0 0 20px;">{{expedient}}</p>
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;">Observaciones</p>
        <p style="margin:0;white-space:pre-wrap;">{{notes}}</p>
      </section>
    </main>',
    'active',
    TRUE
  ),
  (
    NULL,
    'purchase-order-default',
    'Orden de Compra',
    'Plantilla base para ordenes de compra operativas.',
    'PURCHASE_ORDER',
    'ordenes-de-compra',
    1,
    '{
      "fields": [
        {"key":"orderNumber","label":"Numero de orden","type":"text","required":true},
        {"key":"issueDate","label":"Fecha","type":"date","required":true},
        {"key":"supplier","label":"Proveedor","type":"supplier_reference","required":true},
        {"key":"requester","label":"Solicitante","type":"text","required":true},
        {"key":"detail","label":"Detalle","type":"textarea","required":true},
        {"key":"total","label":"Total","type":"money","required":true}
      ]
    }'::jsonb,
    '<main style="font-family: Arial, sans-serif; color: #111827; padding: 32px;">
      <header style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
        <div>
          <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;">Orden de compra</p>
          <h1 style="margin:10px 0 0;font-size:30px;">OC {{orderNumber}}</h1>
        </div>
        <div style="text-align:right;font-size:14px;">
          <div><strong>Obra:</strong> {{workName}}</div>
          <div><strong>Fecha:</strong> {{issueDate}}</div>
        </div>
      </header>
      <section style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">
        <article style="border:1px solid #d1d5db;border-radius:10px;padding:16px;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;">Proveedor</p>
          <p style="margin:0;font-size:18px;font-weight:600;">{{supplier}}</p>
        </article>
        <article style="border:1px solid #d1d5db;border-radius:10px;padding:16px;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;">Solicitante</p>
          <p style="margin:0;font-size:18px;font-weight:600;">{{requester}}</p>
        </article>
      </section>
      <section style="margin-top:20px;border:1px solid #d1d5db;border-radius:10px;padding:16px;">
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;">Detalle</p>
        <p style="margin:0;white-space:pre-wrap;">{{detail}}</p>
      </section>
      <footer style="margin-top:24px;display:flex;justify-content:flex-end;">
        <div style="min-width:220px;border:1px solid #111827;border-radius:12px;padding:16px;text-align:right;">
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;">Total</p>
          <p style="margin:0;font-size:24px;font-weight:700;">{{total}}</p>
        </div>
      </footer>
    </main>',
    'active',
    TRUE
  ),
  (
    NULL,
    'invoice-default',
    'Factura Interna',
    'Plantilla base para facturas internas.',
    'INVOICE',
    'facturas',
    1,
    '{
      "fields": [
        {"key":"invoiceNumber","label":"Numero","type":"text","required":true},
        {"key":"issueDate","label":"Fecha","type":"date","required":true},
        {"key":"concept","label":"Concepto","type":"textarea","required":true},
        {"key":"amount","label":"Importe","type":"money","required":true},
        {"key":"issuer","label":"Emisor","type":"text","required":true}
      ]
    }'::jsonb,
    '<main style="font-family: Arial, sans-serif; color: #111827; padding: 32px;">
      <header style="border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;">Factura interna</p>
        <h1 style="margin:10px 0 0;font-size:30px;">Factura {{invoiceNumber}}</h1>
      </header>
      <section style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:20px;">
        <article style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;"><strong>Obra</strong><p style="margin:10px 0 0;">{{workName}}</p></article>
        <article style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;"><strong>Fecha</strong><p style="margin:10px 0 0;">{{issueDate}}</p></article>
        <article style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;"><strong>Emisor</strong><p style="margin:10px 0 0;">{{issuer}}</p></article>
      </section>
      <section style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:20px;">
        <strong>Concepto</strong>
        <p style="margin:10px 0 0;white-space:pre-wrap;">{{concept}}</p>
      </section>
      <section style="display:flex;justify-content:flex-end;">
        <div style="min-width:220px;background:#111827;color:white;border-radius:12px;padding:16px;text-align:right;">
          <p style="margin:0 0 6px;font-size:12px;opacity:.8;text-transform:uppercase;">Importe</p>
          <p style="margin:0;font-size:24px;font-weight:700;">{{amount}}</p>
        </div>
      </section>
    </main>',
    'active',
    TRUE
  )
ON CONFLICT DO NOTHING;
