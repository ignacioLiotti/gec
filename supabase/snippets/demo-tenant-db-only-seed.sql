-- Demo tenant DB-only seed
--
-- What this creates:
-- - one demo tenant
-- - optional owner membership if you set an existing auth user email
-- - main table config + default document folders/tables
-- - three demo obras
-- - seeded PMC / curve data for alerts, graphs, and macro tables
-- - one demo link for /demo/<slug>?token=<token>
--
-- What this does NOT create:
-- - auth.users rows
-- - Supabase Storage files in obra-documents
-- - tracked uploaded documents / previews
--
-- Before running:
-- 1. Edit the values in the DECLARE block.
-- 2. If you want logged-in admin access too, set v_owner_email to an existing auth user.
-- 3. If you only need anonymous demo-link access, leave v_owner_email as NULL.

do $$
declare
  v_tenant_name text := 'Acme Demo';
  v_demo_slug text := 'acme-demo';
  v_demo_label text := 'Demo Acme';
  v_demo_token text := 'change-me-demo-token';
  v_base_url text := 'https://your-app.example.com';
  v_owner_email text := null;
  v_owner_name text := 'Demo Owner';

  v_owner_user_id uuid;
  v_tenant_id uuid;
  v_demo_admin_role_id uuid;
  v_demo_link_id uuid;
  v_macro_table_id uuid;

  v_default_cert_tabla_id uuid;
  v_default_curve_tabla_id uuid;

  v_obra_101_id uuid;
  v_obra_102_id uuid;
  v_obra_103_id uuid;

  v_obra_101_pmc_resumen_id uuid;
  v_obra_101_pmc_items_id uuid;
  v_obra_101_curva_plan_id uuid;
  v_obra_101_curva_manual_id uuid;
  v_obra_102_pmc_resumen_id uuid;
  v_obra_103_pmc_resumen_id uuid;

  v_current_month date := date_trunc('month', current_date)::date;
  v_current_period text := to_char(date_trunc('month', current_date), 'YYYY-MM');
  v_prev_one_period text := to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM');
  v_prev_two_period text := to_char(date_trunc('month', current_date) - interval '2 months', 'YYYY-MM');
  v_prev_three_period text := to_char(date_trunc('month', current_date) - interval '3 months', 'YYYY-MM');
  v_curve_start_period text := to_char(date_trunc('month', current_date) - interval '4 months', 'YYYY-MM');
  v_forecast_one text := to_char(date_trunc('month', current_date) + interval '4 months', 'YYYY-MM-DD');
  v_forecast_two text := to_char(date_trunc('month', current_date) + interval '6 months', 'YYYY-MM-DD');
  v_forecast_three text := to_char(date_trunc('month', current_date) + interval '3 months', 'YYYY-MM-DD');

  v_main_columns jsonb := '[
    {"id":"n","kind":"base","label":"N","enabled":true,"width":25,"baseColumnId":"n","cellType":"text","required":true,"editable":false,"enableHide":false,"enablePin":true,"enableSort":false,"enableResize":false},
    {"id":"designacionYUbicacion","kind":"base","label":"Designacion y Ubicacion","enabled":true,"baseColumnId":"designacionYUbicacion","cellType":"text","required":true,"editable":true,"enableHide":true,"enablePin":true},
    {"id":"supDeObraM2","kind":"base","label":"Sup. de Obra (m2)","enabled":true,"baseColumnId":"supDeObraM2","cellType":"text","enableHide":true,"enablePin":false},
    {"id":"entidadContratante","kind":"base","label":"Entidad Contratante","enabled":true,"baseColumnId":"entidadContratante","cellType":"text","enableHide":true,"enablePin":true},
    {"id":"mesBasicoDeContrato","kind":"base","label":"Mes Basico de Contrato","enabled":true,"baseColumnId":"mesBasicoDeContrato","cellType":"text","enableHide":true,"enablePin":false},
    {"id":"iniciacion","kind":"base","label":"Iniciacion","enabled":true,"baseColumnId":"iniciacion","cellType":"text","enableHide":true,"enablePin":false},
    {"id":"contratoMasAmpliaciones","kind":"formula","label":"Contrato + Ampliaciones","enabled":true,"baseColumnId":"contratoMasAmpliaciones","formula":"[contratoMasAmpliaciones]","formulaFormat":"currency","cellType":"currency","enableHide":true,"enablePin":false},
    {"id":"certificadoALaFecha","kind":"formula","label":"Certificado a la Fecha","enabled":true,"baseColumnId":"certificadoALaFecha","formula":"[contratoMasAmpliaciones] * ([porcentaje] / 100)","formulaFormat":"currency","cellType":"currency","enableHide":true,"enablePin":false,"editable":false},
    {"id":"saldoACertificar","kind":"formula","label":"Saldo a Certificar","enabled":true,"baseColumnId":"saldoACertificar","formula":"[contratoMasAmpliaciones] - [certificadoALaFecha]","formulaFormat":"currency","cellType":"currency","enableHide":true,"enablePin":false,"editable":false},
    {"id":"segunContrato","kind":"base","label":"Segun Contrato","enabled":true,"baseColumnId":"segunContrato","cellType":"text","enableHide":true,"enablePin":false},
    {"id":"prorrogasAcordadas","kind":"base","label":"Prorrogas Acordadas","enabled":true,"baseColumnId":"prorrogasAcordadas","cellType":"text","enableHide":true,"enablePin":false},
    {"id":"plazoTotal","kind":"base","label":"Plazo Total","enabled":true,"baseColumnId":"plazoTotal","cellType":"text","enableHide":true,"enablePin":false},
    {"id":"plazoTransc","kind":"base","label":"Plazo Transcurrido","enabled":true,"baseColumnId":"plazoTransc","cellType":"text","enableHide":true,"enablePin":false},
    {"id":"porcentaje","kind":"base","label":"% Avance","enabled":true,"baseColumnId":"porcentaje","cellType":"badge","enableHide":true,"enablePin":false},
    {"id":"project_manager","kind":"custom","label":"Project Manager","enabled":true,"width":180,"cellType":"text","editable":true,"enableHide":true,"enablePin":false,"enableSort":true,"enableResize":true},
    {"id":"commercial_stage","kind":"custom","label":"Commercial Stage","enabled":true,"width":170,"cellType":"text","editable":true,"enableHide":true,"enablePin":false,"enableSort":true,"enableResize":true},
    {"id":"forecast_close","kind":"custom","label":"Forecast Close","enabled":true,"width":150,"cellType":"date","editable":true,"enableHide":true,"enablePin":false,"enableSort":true,"enableResize":true}
  ]'::jsonb;
begin
  if exists (select 1 from public.tenants where name = v_tenant_name) then
    raise exception 'A tenant named "%" already exists.', v_tenant_name;
  end if;

  if v_demo_slug is not null and exists (select 1 from public.tenants where demo_slug = v_demo_slug) then
    raise exception 'A tenant with demo_slug "%" already exists.', v_demo_slug;
  end if;

  if exists (select 1 from public.tenant_demo_links where slug = v_demo_slug) then
    raise exception 'A demo link with slug "%" already exists.', v_demo_slug;
  end if;

  if v_owner_email is not null then
    select u.id
      into v_owner_user_id
      from auth.users u
     where lower(u.email) = lower(v_owner_email)
     order by u.created_at asc
     limit 1;

    if v_owner_user_id is null then
      raise exception 'No auth user found for owner email "%".', v_owner_email;
    end if;

    insert into public.profiles (user_id, full_name)
    values (v_owner_user_id, v_owner_name)
    on conflict (user_id) do update
      set full_name = excluded.full_name;
  end if;

  insert into public.tenants (name, demo_slug, demo_settings)
  values (
    v_tenant_name,
    v_demo_slug,
    jsonb_build_object(
      'isDemo', true,
      'createdBy', 'sql-db-only-seed',
      'createdAt', now()
    )
  )
  returning id into v_tenant_id;

  if v_owner_user_id is not null then
    insert into public.memberships (tenant_id, user_id, role)
    values (v_tenant_id, v_owner_user_id, 'owner')
    on conflict (tenant_id, user_id) do update
      set role = excluded.role;
  end if;

  insert into public.roles (tenant_id, key, name, description, color, is_default)
  values (
    v_tenant_id,
    'demo_admin',
    'Demo Admin',
    'Tenant-scoped all-access role for the demo seed.',
    '#0f766e',
    false
  )
  returning id into v_demo_admin_role_id;

  insert into public.role_permissions (role_id, permission_id)
  select v_demo_admin_role_id, p.id
    from public.permissions p
  on conflict do nothing;

  if v_owner_user_id is not null then
    if exists (
      select 1
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'user_roles'
         and column_name = 'tenant_id'
    ) then
      execute
        'insert into public.user_roles (user_id, role_id, tenant_id) values ($1, $2, $3) on conflict do nothing'
      using v_owner_user_id, v_demo_admin_role_id, v_tenant_id;
    else
      insert into public.user_roles (user_id, role_id)
      values (v_owner_user_id, v_demo_admin_role_id)
      on conflict do nothing;
    end if;
  end if;

  insert into public.tenant_main_table_configs (tenant_id, columns, updated_by)
  values (v_tenant_id, v_main_columns, v_owner_user_id)
  on conflict (tenant_id) do update
    set columns = excluded.columns,
        updated_by = excluded.updated_by;

  insert into public.obra_default_folders (tenant_id, name, path, position)
  values
    (v_tenant_id, 'Certificados', 'certificados', 0),
    (v_tenant_id, 'Curva de Avance', 'curva-de-avance', 1),
    (v_tenant_id, 'Ordenes de Compra', 'ordenes-de-compra', 2),
    (v_tenant_id, 'Fotos de Obra', 'fotos-de-obra', 3);

  insert into public.obra_default_tablas (
    tenant_id,
    name,
    description,
    source_type,
    linked_folder_path,
    settings,
    position
  )
  values (
    v_tenant_id,
    'Certificados Extraidos',
    'Tablas derivadas para certificados. Genera PMC Resumen, PMC Items y Curva Plan.',
    'ocr',
    'certificados',
    jsonb_build_object(
      'dataInputMethod', 'both',
      'manualEntryEnabled', true,
      'spreadsheetTemplate', 'certificado',
      'documentTypes', jsonb_build_array('certificado', 'certificado de obra'),
      'extractionInstructions', 'Usar este folder para certificados mensuales. La importacion debe fan-out a PMC Resumen y PMC Items.'
    ),
    0
  )
  returning id into v_default_cert_tabla_id;

  insert into public.obra_default_tabla_columns (
    default_tabla_id,
    field_key,
    label,
    data_type,
    position,
    required,
    config
  )
  values
    (v_default_cert_tabla_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_default_cert_tabla_id, 'monto_certificado', 'Monto Certificado', 'currency', 1, false, '{}'::jsonb),
    (v_default_cert_tabla_id, 'monto_acumulado', 'Monto Acumulado', 'currency', 2, false, '{}'::jsonb);

  insert into public.obra_default_tablas (
    tenant_id,
    name,
    description,
    source_type,
    linked_folder_path,
    settings,
    position
  )
  values (
    v_tenant_id,
    'Curva de Avance Manual',
    'Tabla destino para la carga manual de la curva de avance desde Documentos.',
    'ocr',
    'curva-de-avance',
    jsonb_build_object(
      'dataInputMethod', 'both',
      'manualEntryEnabled', true,
      'spreadsheetTemplate', 'auto',
      'documentTypes', jsonb_build_array('curva de avance', 'curva plan'),
      'extractionInstructions', 'Usar este folder para la planilla de curva de avance. Debe actualizar una fila por periodo.'
    ),
    1
  )
  returning id into v_default_curve_tabla_id;

  insert into public.obra_default_tabla_columns (
    default_tabla_id,
    field_key,
    label,
    data_type,
    position,
    required,
    config
  )
  values
    (v_default_curve_tabla_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_default_curve_tabla_id, 'avance_mensual_pct', 'Avance Mensual %', 'number', 1, false, '{}'::jsonb),
    (v_default_curve_tabla_id, 'avance_acumulado_pct', 'Avance Acumulado %', 'number', 2, false, '{}'::jsonb);

  insert into public.obras (
    tenant_id,
    n,
    designacion_y_ubicacion,
    sup_de_obra_m2,
    entidad_contratante,
    mes_basico_de_contrato,
    iniciacion,
    contrato_mas_ampliaciones,
    certificado_a_la_fecha,
    saldo_a_certificar,
    segun_contrato,
    prorrogas_acordadas,
    plazo_total,
    plazo_transc,
    porcentaje,
    custom_data
  )
  values (
    v_tenant_id,
    101,
    'Hospital Municipal Norte',
    12850,
    'Municipalidad de Cordoba',
    v_prev_three_period,
    to_char(v_current_month - interval '10 months', 'YYYY-MM-DD'),
    156500000,
    0,
    0,
    18,
    2,
    20,
    11,
    63.4,
    jsonb_build_object(
      'project_manager', coalesce(v_owner_name, 'Demo Owner'),
      'commercial_stage', 'Live Demo',
      'forecast_close', v_forecast_one
    )
  )
  returning id into v_obra_101_id;

  insert into public.obras (
    tenant_id,
    n,
    designacion_y_ubicacion,
    sup_de_obra_m2,
    entidad_contratante,
    mes_basico_de_contrato,
    iniciacion,
    contrato_mas_ampliaciones,
    certificado_a_la_fecha,
    saldo_a_certificar,
    segun_contrato,
    prorrogas_acordadas,
    plazo_total,
    plazo_transc,
    porcentaje,
    custom_data
  )
  values (
    v_tenant_id,
    102,
    'Centro Logistico Ribera',
    9400,
    'Grupo Delta',
    v_prev_two_period,
    to_char(v_current_month - interval '7 months', 'YYYY-MM-DD'),
    89200000,
    0,
    0,
    14,
    1,
    15,
    6,
    37.2,
    jsonb_build_object(
      'project_manager', coalesce(v_owner_name, 'Demo Owner'),
      'commercial_stage', 'Qualification',
      'forecast_close', v_forecast_two
    )
  )
  returning id into v_obra_102_id;

  insert into public.obras (
    tenant_id,
    n,
    designacion_y_ubicacion,
    sup_de_obra_m2,
    entidad_contratante,
    mes_basico_de_contrato,
    iniciacion,
    contrato_mas_ampliaciones,
    certificado_a_la_fecha,
    saldo_a_certificar,
    segun_contrato,
    prorrogas_acordadas,
    plazo_total,
    plazo_transc,
    porcentaje,
    custom_data
  )
  values (
    v_tenant_id,
    103,
    'Escuela Tecnica Sur',
    6800,
    'Ministerio de Educacion',
    v_prev_one_period,
    to_char(v_current_month - interval '12 months', 'YYYY-MM-DD'),
    110400000,
    0,
    0,
    12,
    0,
    12,
    10,
    82.1,
    jsonb_build_object(
      'project_manager', coalesce(v_owner_name, 'Demo Owner'),
      'commercial_stage', 'Proposal Sent',
      'forecast_close', v_forecast_three
    )
  )
  returning id into v_obra_103_id;

  insert into public.obra_tablas (obra_id, name, description, source_type, settings)
  values (
    v_obra_101_id,
    'Certificados - PMC Resumen',
    'Resumen mensual del certificado: periodo, monto, avance acumulado.',
    'ocr',
    jsonb_build_object(
      'ocrFolder', 'certificados',
      'spreadsheetTemplate', 'certificado',
      'spreadsheetPresetKey', 'pmc_resumen',
      'defaultTablaId', v_default_cert_tabla_id,
      'dataInputMethod', 'both',
      'manualEntryEnabled', true
    )
  )
  returning id into v_obra_101_pmc_resumen_id;

  insert into public.obra_tabla_columns (tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_obra_101_pmc_resumen_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'nro_certificado', 'Nro Certificado', 'text', 1, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'fecha_certificacion', 'Fecha Certificacion', 'text', 2, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'monto_certificado', 'Monto Certificado', 'currency', 3, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'avance_fisico_acumulado_pct', 'Avance Fisico Acumulado %', 'number', 4, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'monto_acumulado', 'Monto Acumulado', 'currency', 5, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'n_expediente', 'Nro Expediente', 'text', 6, false, '{}'::jsonb);

  insert into public.obra_tablas (obra_id, name, description, source_type, settings)
  values (
    v_obra_101_id,
    'Certificados - PMC Items',
    'Desglose por rubro/item del certificado con avances e importes.',
    'ocr',
    jsonb_build_object(
      'ocrFolder', 'certificados',
      'spreadsheetTemplate', 'certificado',
      'spreadsheetPresetKey', 'pmc_items',
      'defaultTablaId', v_default_cert_tabla_id,
      'dataInputMethod', 'both',
      'manualEntryEnabled', true
    )
  )
  returning id into v_obra_101_pmc_items_id;

  insert into public.obra_tabla_columns (tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_obra_101_pmc_items_id, 'item_code', 'Codigo Item', 'text', 0, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'descripcion', 'Descripcion', 'text', 1, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'incidencia_pct', 'Incidencia %', 'number', 2, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'monto_rubro', 'Monto Rubro', 'currency', 3, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'avance_anterior_pct', 'Avance Anterior %', 'number', 4, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'avance_periodo_pct', 'Avance Periodo %', 'number', 5, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'avance_acumulado_pct', 'Avance Acumulado %', 'number', 6, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'monto_anterior', 'Monto Anterior', 'currency', 7, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'monto_presente', 'Monto Presente', 'currency', 8, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'monto_acumulado', 'Monto Acumulado', 'currency', 9, false, '{}'::jsonb);

  insert into public.obra_tablas (obra_id, name, description, source_type, settings)
  values (
    v_obra_101_id,
    'Certificados - Curva Plan',
    'Curva de inversiones con avance mensual y acumulado.',
    'ocr',
    jsonb_build_object(
      'ocrFolder', 'certificados',
      'spreadsheetTemplate', 'certificado',
      'spreadsheetPresetKey', 'curva_plan',
      'defaultTablaId', v_default_cert_tabla_id,
      'dataInputMethod', 'both',
      'manualEntryEnabled', true
    )
  )
  returning id into v_obra_101_curva_plan_id;

  insert into public.obra_tabla_columns (tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_obra_101_curva_plan_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_101_curva_plan_id, 'avance_mensual_pct', 'Avance Mensual %', 'number', 1, false, '{}'::jsonb),
    (v_obra_101_curva_plan_id, 'avance_acumulado_pct', 'Avance Acumulado %', 'number', 2, false, '{}'::jsonb);

  insert into public.obra_tablas (obra_id, name, description, source_type, settings)
  values (
    v_obra_101_id,
    'Curva de Avance Manual',
    'Tabla destino para la carga manual de la curva de avance desde Documentos.',
    'ocr',
    jsonb_build_object(
      'ocrFolder', 'curva-de-avance',
      'defaultTablaId', v_default_curve_tabla_id,
      'dataInputMethod', 'both',
      'manualEntryEnabled', true
    )
  )
  returning id into v_obra_101_curva_manual_id;

  insert into public.obra_tabla_columns (tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_obra_101_curva_manual_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_101_curva_manual_id, 'avance_mensual_pct', 'Avance Mensual %', 'number', 1, false, '{}'::jsonb),
    (v_obra_101_curva_manual_id, 'avance_acumulado_pct', 'Avance Acumulado %', 'number', 2, false, '{}'::jsonb);

  insert into public.obra_tablas (obra_id, name, description, source_type, settings)
  values (
    v_obra_102_id,
    'Certificados - PMC Resumen',
    'Resumen mensual del certificado: periodo, monto, avance acumulado.',
    'ocr',
    jsonb_build_object(
      'ocrFolder', 'certificados',
      'spreadsheetTemplate', 'certificado',
      'spreadsheetPresetKey', 'pmc_resumen',
      'defaultTablaId', v_default_cert_tabla_id
    )
  )
  returning id into v_obra_102_pmc_resumen_id;

  insert into public.obra_tabla_columns (tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_obra_102_pmc_resumen_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'nro_certificado', 'Nro Certificado', 'text', 1, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'fecha_certificacion', 'Fecha Certificacion', 'text', 2, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'monto_certificado', 'Monto Certificado', 'currency', 3, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'avance_fisico_acumulado_pct', 'Avance Fisico Acumulado %', 'number', 4, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'monto_acumulado', 'Monto Acumulado', 'currency', 5, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'n_expediente', 'Nro Expediente', 'text', 6, false, '{}'::jsonb);

  insert into public.obra_tablas (obra_id, name, description, source_type, settings)
  values (
    v_obra_103_id,
    'Certificados - PMC Resumen',
    'Resumen mensual del certificado: periodo, monto, avance acumulado.',
    'ocr',
    jsonb_build_object(
      'ocrFolder', 'certificados',
      'spreadsheetTemplate', 'certificado',
      'spreadsheetPresetKey', 'pmc_resumen',
      'defaultTablaId', v_default_cert_tabla_id
    )
  )
  returning id into v_obra_103_pmc_resumen_id;

  insert into public.obra_tabla_columns (tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_obra_103_pmc_resumen_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'nro_certificado', 'Nro Certificado', 'text', 1, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'fecha_certificacion', 'Fecha Certificacion', 'text', 2, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'monto_certificado', 'Monto Certificado', 'currency', 3, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'avance_fisico_acumulado_pct', 'Avance Fisico Acumulado %', 'number', 4, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'monto_acumulado', 'Monto Acumulado', 'currency', 5, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'n_expediente', 'Nro Expediente', 'text', 6, false, '{}'::jsonb);

  insert into public.obra_tabla_rows (tabla_id, data, source)
  values
    (
      v_obra_101_pmc_resumen_id,
      jsonb_build_object(
        'periodo', v_prev_two_period,
        'nro_certificado', '11',
        'fecha_certificacion', v_prev_two_period || '-27',
        'monto_certificado', 18650000,
        'avance_fisico_acumulado_pct', 49.8,
        'monto_acumulado', 77110000,
        'n_expediente', 'EXP-2026-014'
      ),
      'seed'
    ),
    (
      v_obra_101_pmc_resumen_id,
      jsonb_build_object(
        'periodo', v_prev_one_period,
        'nro_certificado', '12',
        'fecha_certificacion', v_prev_one_period || '-28',
        'monto_certificado', 22100000,
        'avance_fisico_acumulado_pct', 63.4,
        'monto_acumulado', 99210000,
        'n_expediente', 'EXP-2026-014'
      ),
      'seed'
    ),
    (
      v_obra_102_pmc_resumen_id,
      jsonb_build_object(
        'periodo', v_prev_one_period,
        'nro_certificado', '08',
        'fecha_certificacion', v_prev_one_period || '-26',
        'monto_certificado', 9800000,
        'avance_fisico_acumulado_pct', 37.2,
        'monto_acumulado', 33182400,
        'n_expediente', 'DLT-882/2026'
      ),
      'seed'
    ),
    (
      v_obra_103_pmc_resumen_id,
      jsonb_build_object(
        'periodo', v_prev_one_period,
        'nro_certificado', '15',
        'fecha_certificacion', v_prev_one_period || '-25',
        'monto_certificado', 14300000,
        'avance_fisico_acumulado_pct', 82.1,
        'monto_acumulado', 90638400,
        'n_expediente', 'MINED-410/2026'
      ),
      'seed'
    );

  insert into public.obra_tabla_rows (tabla_id, data, source)
  values
    (
      v_obra_101_pmc_items_id,
      jsonb_build_object(
        'item_code', '01.01',
        'descripcion', 'Movimiento de suelo',
        'incidencia_pct', 18.4,
        'monto_rubro', 28800000,
        'avance_anterior_pct', 68,
        'avance_periodo_pct', 7,
        'avance_acumulado_pct', 75,
        'monto_anterior', 23500000,
        'monto_presente', 5300000,
        'monto_acumulado', 28800000
      ),
      'seed'
    ),
    (
      v_obra_101_pmc_items_id,
      jsonb_build_object(
        'item_code', '03.02',
        'descripcion', 'Estructura de hormigon',
        'incidencia_pct', 42.7,
        'monto_rubro', 66800000,
        'avance_anterior_pct', 54,
        'avance_periodo_pct', 9.4,
        'avance_acumulado_pct', 63.4,
        'monto_anterior', 56900000,
        'monto_presente', 9900000,
        'monto_acumulado', 66800000
      ),
      'seed'
    );

  insert into public.obra_tabla_rows (tabla_id, data, source)
  values
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 1', 'avance_mensual_pct', 8, 'avance_acumulado_pct', 8), 'seed'),
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 2', 'avance_mensual_pct', 11, 'avance_acumulado_pct', 19), 'seed'),
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 3', 'avance_mensual_pct', 13, 'avance_acumulado_pct', 32), 'seed'),
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 4', 'avance_mensual_pct', 14, 'avance_acumulado_pct', 46), 'seed'),
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 5', 'avance_mensual_pct', 17.4, 'avance_acumulado_pct', 63.4), 'seed'),
    (v_obra_101_curva_manual_id, jsonb_build_object('periodo', 'Mes 1', 'avance_mensual_pct', 8, 'avance_acumulado_pct', 8), 'seed'),
    (v_obra_101_curva_manual_id, jsonb_build_object('periodo', 'Mes 2', 'avance_mensual_pct', 11, 'avance_acumulado_pct', 19), 'seed'),
    (v_obra_101_curva_manual_id, jsonb_build_object('periodo', 'Mes 3', 'avance_mensual_pct', 13, 'avance_acumulado_pct', 32), 'seed'),
    (v_obra_101_curva_manual_id, jsonb_build_object('periodo', 'Mes 4', 'avance_mensual_pct', 14, 'avance_acumulado_pct', 46), 'seed'),
    (v_obra_101_curva_manual_id, jsonb_build_object('periodo', 'Mes 5', 'avance_mensual_pct', 17.4, 'avance_acumulado_pct', 63.4), 'seed');

  insert into public.obra_rule_config (tenant_id, obra_id, config_json, updated_at)
  values (
    v_tenant_id,
    v_obra_101_id,
    jsonb_build_object(
      'enabledPacks', jsonb_build_object(
        'curve', true,
        'unpaidCerts', false,
        'inactivity', false,
        'monthlyMissingCert', true,
        'stageStalled', false
      ),
      'mappings', jsonb_build_object(
        'curve', jsonb_build_object(
          'planTableId', v_obra_101_curva_plan_id,
          'resumenTableId', v_obra_101_pmc_resumen_id,
          'actualPctColumnKey', 'avance_fisico_acumulado_pct',
          'plan', jsonb_build_object('startPeriod', v_curve_start_period)
        ),
        'monthlyMissingCert', jsonb_build_object(
          'certTableId', v_obra_101_pmc_resumen_id,
          'certIssuedAtColumnKey', 'fecha_certificacion'
        )
      ),
      'thresholds', jsonb_build_object(
        'curve', jsonb_build_object('warnBelow', 10, 'criticalBelow', 20),
        'unpaidCerts', jsonb_build_object('severity', 'warn'),
        'inactivity', jsonb_build_object('severity', 'warn'),
        'monthlyMissingCert', jsonb_build_object('severity', 'warn'),
        'stageStalled', jsonb_build_object('severity', 'warn')
      )
    ),
    now()
  );

  insert into public.obra_findings (
    tenant_id,
    obra_id,
    period_key,
    rule_key,
    severity,
    title,
    message,
    evidence_json,
    status
  )
  values
    (
      v_tenant_id,
      v_obra_101_id,
      v_current_period,
      'cert.missing_current_month',
      'warn',
      'Falta certificado del mes actual',
      'Se detectaron certificados en meses anteriores pero falta el certificado del periodo ' || v_current_period || '.',
      jsonb_build_object('period', v_current_period),
      'open'
    ),
    (
      v_tenant_id,
      v_obra_101_id,
      v_current_period,
      'curve.critical_below_plan',
      'critical',
      'Desvio critico en curva',
      'El avance esta 50.1 puntos por debajo del plan.',
      jsonb_build_object('belowPlanPoints', 50.1, 'period', v_current_period),
      'open'
    );

  insert into public.macro_tables (tenant_id, name, description, settings)
  values (
    v_tenant_id,
    'Tablas',
    'Vista agregada de certificados PMC Resumen para demo.',
    jsonb_build_object('seededBy', 'demo-tenant-db-only-seed')
  )
  returning id into v_macro_table_id;

  insert into public.macro_table_sources (macro_table_id, obra_tabla_id, position)
  values
    (v_macro_table_id, v_obra_101_pmc_resumen_id, 0),
    (v_macro_table_id, v_obra_102_pmc_resumen_id, 1),
    (v_macro_table_id, v_obra_103_pmc_resumen_id, 2);

  insert into public.macro_table_columns (macro_table_id, column_type, source_field_key, label, data_type, position, config)
  values
    (v_macro_table_id, 'source', 'periodo', 'Periodo', 'text', 0, '{}'::jsonb),
    (v_macro_table_id, 'source', 'nro_certificado', 'Nro Certificado', 'text', 1, '{}'::jsonb),
    (v_macro_table_id, 'source', 'monto_certificado', 'Monto Certificado', 'currency', 2, '{}'::jsonb),
    (v_macro_table_id, 'source', 'monto_acumulado', 'Monto Acumulado', 'currency', 3, '{}'::jsonb),
    (v_macro_table_id, 'source', 'avance_fisico_acumulado_pct', 'Avance Acumulado %', 'number', 4, '{}'::jsonb);

  insert into public.sidebar_macro_tables (role_id, macro_table_id, position)
  values (v_demo_admin_role_id, v_macro_table_id, 0)
  on conflict do nothing;

  insert into public.tenant_demo_links (
    tenant_id,
    slug,
    label,
    token_hash,
    allowed_capabilities,
    created_by
  )
  values (
    v_tenant_id,
    v_demo_slug,
    v_demo_label,
    encode(digest(v_demo_token, 'sha256'), 'hex'),
    '["dashboard","excel","macro"]'::jsonb,
    v_owner_user_id
  )
  returning id into v_demo_link_id;

  raise notice 'Demo tenant created: % (%)', v_tenant_name, v_tenant_id;
  raise notice 'Demo link id: %', v_demo_link_id;
  raise notice 'Demo URL: %/demo/%?token=%', trim(trailing '/' from v_base_url), v_demo_slug, v_demo_token;
  if v_owner_user_id is null then
    raise notice 'No owner membership was created because v_owner_email is NULL.';
  else
    raise notice 'Owner membership created for % (%).', v_owner_email, v_owner_user_id;
  end if;
  raise notice 'Storage-backed document previews are not seeded by this SQL.';
end
$$;
