-- Engine MVP tables for flow instances, runs, steps, and events

CREATE TABLE IF NOT EXISTS public.flow_instance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  flow_definition_id TEXT NOT NULL,
  definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  lock_token TEXT,
  lock_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flow_instance_unique UNIQUE (obra_id, flow_definition_id)
);

CREATE INDEX IF NOT EXISTS flow_instance_obra_idx
  ON public.flow_instance(obra_id);

CREATE TABLE IF NOT EXISTS public.flow_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.flow_instance(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flow_run_unique UNIQUE (instance_id, period)
);

CREATE INDEX IF NOT EXISTS flow_run_instance_idx
  ON public.flow_run(instance_id);

CREATE TABLE IF NOT EXISTS public.flow_step_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.flow_run(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('blocked', 'ready', 'running', 'done', 'failed')),
  reason JSONB,
  inputs_json JSONB,
  outputs_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flow_step_state_unique UNIQUE (run_id, step_id)
);

CREATE INDEX IF NOT EXISTS flow_step_state_run_idx
  ON public.flow_step_state(run_id);

CREATE TABLE IF NOT EXISTS public.flow_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.flow_run(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  payload_json JSONB,
  dedupe_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flow_event_obra_idx
  ON public.flow_event(obra_id);

CREATE INDEX IF NOT EXISTS flow_event_run_idx
  ON public.flow_event(run_id);

ALTER TABLE public.flow_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_step_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view flow instances in their tenant"
  ON public.flow_instance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE obras.id = flow_instance.obra_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage flow instances in their tenant"
  ON public.flow_instance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE obras.id = flow_instance.obra_id
      AND memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE obras.id = flow_instance.obra_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view flow runs in their tenant"
  ON public.flow_run
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flow_instance
      JOIN public.obras ON obras.id = flow_instance.obra_id
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE flow_instance.id = flow_run.instance_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage flow runs in their tenant"
  ON public.flow_run
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.flow_instance
      JOIN public.obras ON obras.id = flow_instance.obra_id
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE flow_instance.id = flow_run.instance_id
      AND memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flow_instance
      JOIN public.obras ON obras.id = flow_instance.obra_id
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE flow_instance.id = flow_run.instance_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view flow step states in their tenant"
  ON public.flow_step_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flow_run
      JOIN public.flow_instance ON flow_instance.id = flow_run.instance_id
      JOIN public.obras ON obras.id = flow_instance.obra_id
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE flow_run.id = flow_step_state.run_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage flow step states in their tenant"
  ON public.flow_step_state
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.flow_run
      JOIN public.flow_instance ON flow_instance.id = flow_run.instance_id
      JOIN public.obras ON obras.id = flow_instance.obra_id
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE flow_run.id = flow_step_state.run_id
      AND memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flow_run
      JOIN public.flow_instance ON flow_instance.id = flow_run.instance_id
      JOIN public.obras ON obras.id = flow_instance.obra_id
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE flow_run.id = flow_step_state.run_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view flow events in their tenant"
  ON public.flow_event
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE obras.id = flow_event.obra_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage flow events in their tenant"
  ON public.flow_event
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.obras
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE obras.id = flow_event.obra_id
      AND memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras
      JOIN public.memberships ON memberships.tenant_id = obras.tenant_id
      WHERE obras.id = flow_event.obra_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE TRIGGER flow_step_state_updated_at
  BEFORE UPDATE ON public.flow_step_state
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
