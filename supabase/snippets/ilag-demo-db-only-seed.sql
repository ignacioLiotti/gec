-- ILAG demo tenant DB-only seed for ignacioliotti@gmail.com
-- Non-OCR folders such as Fotos de Obra only appear in the file tree after at least one file exists in Storage.

do $$
declare
  v_tenant_name text := 'ILAG Demo3';
  v_demo_slug text := 'ilag-demo3';
  v_demo_label text := 'ILAG Demo3';
  v_demo_token text := 'ilag-demo3';
  v_base_url text := 'https://sintesis.dev';
  v_owner_email text := 'ignacioliotti@gmail.com';
  v_owner_name text := 'Ignacio Liotti';

  v_owner_user_id uuid;
  v_tenant_id uuid;
  v_demo_admin_role_id uuid;
  v_demo_link_id uuid;
  v_macro_table_id uuid;

  v_cert_template_id uuid;
  v_orders_template_id uuid;

  v_default_cert_tabla_id uuid;
  v_default_curve_tabla_id uuid;
  v_default_orders_tabla_id uuid;
  v_default_orders_2_tabla_id uuid;

  v_obra_101_id uuid;
  v_obra_102_id uuid;
  v_obra_103_id uuid;

  v_obra_101_certificados_extraidos_id uuid;
  v_obra_101_curva_manual_id uuid;
  v_obra_101_orders_id uuid;
  v_obra_101_orders_2_id uuid;

  v_obra_101_pmc_resumen_id uuid;
  v_obra_101_pmc_items_id uuid;
  v_obra_101_curva_plan_id uuid;
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

  v_cert_extraction_instructions text := 'Usar este folder para certificados mensuales. La importacion debe fan-out a PMC Resumen y PMC Items. todas las fechas deben ser en formato DD/MM/AA. Los numeros de certificado usualmente deben ser numeros simples, 1, 2, 3, etc, nunca seran numeros con simbolos (3/2025, 8-2-275, etc)';
  v_curve_extraction_instructions text := 'Usar este folder para la planilla de curva de avance. Debe actualizar una fila por periodo.';
  v_orders_extraction_instructions text := 'Usar este folder para ordenes de compra de materiales. Extraer nro de orden, solicitante, gestor, proveedor y por cada item cantidad, unidad, detalle descriptivo, precio unitario y precio total. Si el documento incluye el total de la orden, conservarlo.';

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
  if exists (select 1 from public.tenants where demo_slug = v_demo_slug) then
    raise exception 'A tenant with demo_slug "%" already exists.', v_demo_slug;
  end if;
  if exists (select 1 from public.tenant_demo_links where slug = v_demo_slug) then
    raise exception 'A demo link with slug "%" already exists.', v_demo_slug;
  end if;

  select u.id into v_owner_user_id
    from auth.users u
   where lower(u.email) = lower(v_owner_email)
   order by u.created_at asc
   limit 1;

  if v_owner_user_id is null then
    raise exception 'No auth user found for owner email "%".', v_owner_email;
  end if;

  insert into public.profiles (user_id, full_name)
  values (v_owner_user_id, v_owner_name)
  on conflict (user_id) do update set full_name = excluded.full_name;

  insert into public.tenants (name, demo_slug, demo_settings)
  values (v_tenant_name, v_demo_slug, jsonb_build_object('isDemo', true, 'createdBy', 'sql-db-only-seed', 'createdAt', now()))
  returning id into v_tenant_id;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_tenant_id, v_owner_user_id, 'owner')
  on conflict (tenant_id, user_id) do update set role = excluded.role;

  insert into public.roles (tenant_id, key, name, description, color, is_default)
  values (v_tenant_id, 'demo_admin', 'Demo Admin', 'Tenant-scoped all-access role for the demo seed.', '#0f766e', false)
  returning id into v_demo_admin_role_id;

  insert into public.role_permissions (role_id, permission_id)
  select v_demo_admin_role_id, p.id from public.permissions p
  on conflict do nothing;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'user_roles' and column_name = 'tenant_id'
  ) then
    execute 'insert into public.user_roles (user_id, role_id, tenant_id) values ($1, $2, $3) on conflict do nothing'
    using v_owner_user_id, v_demo_admin_role_id, v_tenant_id;
  else
    insert into public.user_roles (user_id, role_id)
    values (v_owner_user_id, v_demo_admin_role_id)
    on conflict do nothing;
  end if;

  insert into public.tenant_main_table_configs (tenant_id, columns, updated_by)
  values (v_tenant_id, v_main_columns, v_owner_user_id)
  on conflict (tenant_id) do update set columns = excluded.columns, updated_by = excluded.updated_by;

  -- OCR templates
  insert into public.ocr_templates (tenant_id, name, description, template_bucket, template_path, template_file_name, template_width, template_height, regions, columns, is_active)
  values (
    v_tenant_id,
    'Certificado De Obra',
    'Certificado de obra que puede estar compuesto por una o varias páginas. El documento puede contener la siguiente información: Número de documento o expediente Fecha de emisión del certificado (formato dd/mm/aa) Número de certificado Montos del certificado Los montos pueden aparecer en distintas formas: Monto total del certificado en moneda, con formato: Símbolo pesos: $ Separador de miles con punto Decimales con coma Ejemplo: $100.000,00 Porcentaje de avance del certificado (porcentaje del período) Porcentaje de avance acumulado (porcentaje total acumulado de la obra) Monto acumulado en dinero (total acumulado certificado en moneda) Esta información puede aparecer en tablas, cuadros resumen o textos dentro del documento, y puede repetirse o variar su ubicación entre distintos certificados.',
    'obra-documents',
    'templates/Captura de pantalla 2026-04-04 225530.png',
    'Captura de pantalla 2026-04-04 225530.png',
    900,
    1280,
    jsonb_build_array(
      jsonb_build_object('id','nro-certificado','x',40,'y',40,'width',180,'height',60,'label','NRO CERTIFICADO','description','Numero simple de certificado','type','single','pageNumber',1),
      jsonb_build_object('id','periodo','x',240,'y',40,'width',180,'height',60,'label','PERIODO','description','Periodo del certificado','type','single','pageNumber',1),
      jsonb_build_object('id','fecha-certificacion','x',440,'y',40,'width',180,'height',60,'label','FECHA CERTIFICACION','description','Fecha en formato DD/MM/AA','type','single','pageNumber',1),
      jsonb_build_object('id','nro-expediente','x',640,'y',40,'width',180,'height',60,'label','NRO EXPEDIENTE','description','Expediente o referencia','type','single','pageNumber',1),
      jsonb_build_object('id','monto-certificado','x',40,'y',120,'width',220,'height',70,'label','MONTO CERTIFICADO','description','Monto del certificado','type','single','pageNumber',1),
      jsonb_build_object('id','avance-fisico-acumulado','x',280,'y',120,'width',260,'height',70,'label','AVANCE FISICO ACUMULADO %','description','Porcentaje acumulado','type','single','pageNumber',1),
      jsonb_build_object('id','monto-acumulado','x',560,'y',120,'width',220,'height',70,'label','MONTO ACUMULADO','description','Monto acumulado','type','single','pageNumber',1)
    ),
    '[
      {"id":"parent:nro-certificado","fieldKey":"nro_certificado","label":"NRO CERTIFICADO","dataType":"text","ocrScope":"parent","description":"Numeros simples, 1, 2, 3, etc. Nunca con simbolos como 3/2025.","aliases":["nro certificado","numero certificado"],"examples":["1"],"excelKeywords":["nro","numero","certificado"],"required":false},
      {"id":"parent:periodo","fieldKey":"periodo","label":"PERIODO","dataType":"text","ocrScope":"parent","description":"Periodo del certificado.","aliases":["periodo","mes"],"examples":["abril 2026"],"excelKeywords":["periodo","mes","correspondiente"],"required":false},
      {"id":"parent:fecha-certificacion","fieldKey":"fecha_certificacion","label":"FECHA CERTIFICACION","dataType":"text","ocrScope":"parent","description":"Todas las fechas deben quedar en formato DD/MM/AA.","aliases":["fecha certificacion","fecha"],"examples":["15/04/26"],"excelKeywords":["fecha","certificacion"],"required":false},
      {"id":"parent:nro-expediente","fieldKey":"nro_expediente","label":"NRO EXPEDIENTE","dataType":"text","ocrScope":"parent","description":"Expediente o identificador administrativo.","aliases":["nro expediente","expediente"],"examples":["EXP-2026-014"],"excelKeywords":["expediente","exp","nro"],"required":false},
      {"id":"parent:monto-certificado","fieldKey":"monto_certificado","label":"MONTO CERTIFICADO","dataType":"text","ocrScope":"parent","description":"Monto del certificado.","aliases":["monto certificado","importe"],"examples":["$ 17.000.000,00"],"excelKeywords":["monto","importe","certificado"],"required":false},
      {"id":"parent:avance-fisico-acumulado","fieldKey":"avance_fisico_acumulado_pct","label":"AVANCE FISICO ACUMULADO %","dataType":"text","ocrScope":"parent","description":"Porcentaje acumulado de avance fisico.","aliases":["avance fisico acumulado"],"examples":["34"],"excelKeywords":["avance","fisico","acumulado","%"],"required":false},
      {"id":"parent:monto-acumulado","fieldKey":"monto_acumulado","label":"MONTO ACUMULADO","dataType":"text","ocrScope":"parent","description":"Monto acumulado certificado.","aliases":["monto acumulado"],"examples":["$ 55.000.000,00"],"excelKeywords":["monto","acumulado","total"],"required":false}
    ]'::jsonb,
    true
  ) returning id into v_cert_template_id;

  insert into public.ocr_templates (tenant_id, name, description, template_bucket, template_path, template_file_name, template_width, template_height, regions, columns, is_active)
  values (
    v_tenant_id,
    'Ordenes de Compra',
    'Tabla de órdenes de compra de materiales o servicios para una obra, donde cada fila representa un ítem comprado, indicando solicitante, gestor, proveedor, cantidad, unidad, descripción del material, precio unitario y precio total por ítem, mientras que la orden completa tiene un total general que representa el monto total de la compra.',
    'obra-documents',
    'templates/Orden de compra1.png',
    'Orden de compra1.png',
    900,
    1280,
    jsonb_build_array(
      jsonb_build_object('id','nro','x',40,'y',40,'width',160,'height',60,'label','NRO','description','Numero de orden','type','single','pageNumber',1),
      jsonb_build_object('id','solicitante','x',220,'y',40,'width',200,'height',60,'label','SOLICITANTE','description','Solicitante de la orden','type','single','pageNumber',1),
      jsonb_build_object('id','proveedor','x',440,'y',40,'width',200,'height',60,'label','PROVEEDOR','description','Proveedor de la orden','type','single','pageNumber',1),
      jsonb_build_object('id','total-orden','x',660,'y',40,'width',160,'height',60,'label','TOTAL ORDEN','description','Total general de la orden','type','single','pageNumber',1),
      jsonb_build_object('id','detalle-materiales','x',24,'y',180,'width',852,'height',520,'label','Detalle de Materiales','description','Tabla de items','type','table','pageNumber',1,'tableColumns',jsonb_build_array('Cantidad','Unidad','DETALLE DESCRIPTIVO','PRECIO UNITARIO','PRECIO TOTAL'))
    ),
    '[
      {"id":"parent:nro","fieldKey":"nro","label":"NRO","dataType":"text","ocrScope":"parent","description":"Numero de orden.","aliases":["nro","numero"],"examples":["OC-001"],"excelKeywords":["nro","numero","orden"],"required":false},
      {"id":"parent:solicitante","fieldKey":"solicitante","label":"SOLICITANTE","dataType":"text","ocrScope":"parent","description":"Solicitante de la orden.","aliases":["solicitante"],"examples":["Oficina Tecnica"],"excelKeywords":["solicitante"],"required":false},
      {"id":"parent:proveedor","fieldKey":"proveedor","label":"PROVEEDOR","dataType":"text","ocrScope":"parent","description":"Proveedor de la orden.","aliases":["proveedor"],"examples":["Hormigones del Norte"],"excelKeywords":["proveedor"],"required":false},
      {"id":"parent:total-orden","fieldKey":"total_orden","label":"TOTAL ORDEN","dataType":"text","ocrScope":"parent","description":"Monto total de la orden.","aliases":["total orden","total"],"examples":["$ 2.300.000,00"],"excelKeywords":["total","orden","importe"],"required":false},
      {"id":"item:detalle-materiales:0","fieldKey":"cantidad","label":"Cantidad","dataType":"text","ocrScope":"item","description":"Cantidad del item.","aliases":["cantidad"],"examples":["24"],"excelKeywords":["cantidad"],"required":false},
      {"id":"item:detalle-materiales:1","fieldKey":"unidad","label":"Unidad","dataType":"text","ocrScope":"item","description":"Unidad del item.","aliases":["unidad"],"examples":["m3"],"excelKeywords":["unidad"],"required":false},
      {"id":"item:detalle-materiales:2","fieldKey":"detalle_descriptivo","label":"DETALLE DESCRIPTIVO","dataType":"text","ocrScope":"item","description":"Descripcion del item.","aliases":["detalle descriptivo","detalle"],"examples":["Hormigon H21"],"excelKeywords":["detalle","descriptivo","material"],"required":false},
      {"id":"item:detalle-materiales:3","fieldKey":"precio_unitario","label":"PRECIO UNITARIO","dataType":"text","ocrScope":"item","description":"Precio unitario del item.","aliases":["precio unitario"],"examples":["$ 120.000,00"],"excelKeywords":["precio","unitario"],"required":false},
      {"id":"item:detalle-materiales:4","fieldKey":"precio_total","label":"PRECIO TOTAL","dataType":"text","ocrScope":"item","description":"Precio total del item.","aliases":["precio total","importe total"],"examples":["$ 2.880.000,00"],"excelKeywords":["precio","total","importe"],"required":false}
    ]'::jsonb,
    true
  ) returning id into v_orders_template_id;

  insert into public.obra_default_folders (tenant_id, name, path, position)
  values
    (v_tenant_id, 'Certificados', 'certificados', 0),
    (v_tenant_id, 'Curva de Avance', 'curva-de-avance', 1),
    (v_tenant_id, 'Ordenes de Compra', 'ordenes-de-compra', 2),
    (v_tenant_id, 'Fotos de Obra', 'fotos-de-obra', 3),
    (v_tenant_id, 'Ordenes 2', 'ordenes-2', 4);

  insert into public.obra_default_tablas (tenant_id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id)
  values (
    v_tenant_id,
    'Certificados Extraidos',
    'Extracción principal de certificados.',
    'ocr',
    'certificados',
    jsonb_build_object(
      'dataInputMethod', 'both',
      'manualEntryEnabled', true,
      'spreadsheetTemplate', 'certificado',
      'ocrTemplateId', v_cert_template_id,
      'ocrTemplateName', 'Certificado De Obra',
      'extractionRowMode', 'single',
      'extractionMaxRows', 1,
      'extractionDocumentTypes', jsonb_build_array('certificado de obra'),
      'documentTypes', jsonb_build_array('certificado de obra'),
      'extractionInstructions', v_cert_extraction_instructions,
      'extractedTables', jsonb_build_array(
        jsonb_build_object(
          'id','certificados-extraidos','name','Certificados Extraidos','rowMode','single','maxRows',1,
          'dataInputMethod','both','spreadsheetTemplate','certificado','ocrTemplateId',v_cert_template_id,'ocrTemplateName','Certificado De Obra',
          'manualEntryEnabled',true,'hasNestedData',false,'documentTypes',jsonb_build_array('certificado de obra'),
          'extractionInstructions',v_cert_extraction_instructions,
          'columns',jsonb_build_array(
            jsonb_build_object('fieldKey','nro_certificado','label','NRO CERTIFICADO','dataType','text'),
            jsonb_build_object('fieldKey','periodo','label','PERIODO','dataType','text'),
            jsonb_build_object('fieldKey','fecha_certificacion','label','FECHA CERTIFICACION','dataType','text'),
            jsonb_build_object('fieldKey','nro_expediente','label','NRO EXPEDIENTE','dataType','text'),
            jsonb_build_object('fieldKey','monto_certificado','label','MONTO CERTIFICADO','dataType','text'),
            jsonb_build_object('fieldKey','avance_fisico_acumulado_pct','label','AVANCE FISICO ACUMULADO %','dataType','text'),
            jsonb_build_object('fieldKey','monto_acumulado','label','MONTO ACUMULADO','dataType','text')
          )
        )
      )
    ),
    0,
    v_cert_template_id
  ) returning id into v_default_cert_tabla_id;

  insert into public.obra_default_tabla_columns (default_tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_default_cert_tabla_id, 'nro_certificado', 'NRO CERTIFICADO', 'text', 0, false, jsonb_build_object('excelKeywords', jsonb_build_array('nro','numero','certificado'))),
    (v_default_cert_tabla_id, 'periodo', 'PERIODO', 'text', 1, false, jsonb_build_object('excelKeywords', jsonb_build_array('periodo','mes'))),
    (v_default_cert_tabla_id, 'fecha_certificacion', 'FECHA CERTIFICACION', 'text', 2, false, jsonb_build_object('excelKeywords', jsonb_build_array('fecha','certificacion'))),
    (v_default_cert_tabla_id, 'nro_expediente', 'NRO EXPEDIENTE', 'text', 3, false, jsonb_build_object('excelKeywords', jsonb_build_array('expediente','exp'))),
    (v_default_cert_tabla_id, 'monto_certificado', 'MONTO CERTIFICADO', 'text', 4, false, jsonb_build_object('excelKeywords', jsonb_build_array('monto','importe','certificado'))),
    (v_default_cert_tabla_id, 'avance_fisico_acumulado_pct', 'AVANCE FISICO ACUMULADO %', 'text', 5, false, jsonb_build_object('excelKeywords', jsonb_build_array('avance','fisico','acumulado','%'))),
    (v_default_cert_tabla_id, 'monto_acumulado', 'MONTO ACUMULADO', 'text', 6, false, jsonb_build_object('excelKeywords', jsonb_build_array('monto','acumulado','total')));

  insert into public.obra_default_tablas (tenant_id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id)
  values (
    v_tenant_id,
    'Curva de Avance Manual',
    'Tabla destino para la carga manual de la curva de avance desde Documentos.',
    'ocr',
    'curva-de-avance',
    jsonb_build_object(
      'dataInputMethod', 'both','manualEntryEnabled', true,'spreadsheetTemplate', 'auto',
      'extractionRowMode', 'single','extractionMaxRows', 1,'extractionInstructions', v_curve_extraction_instructions,
      'extractedTables', jsonb_build_array(
        jsonb_build_object(
          'id','curva-manual','name','Curva de Avance Manual','rowMode','single','maxRows',1,
          'dataInputMethod','both','spreadsheetTemplate','auto','manualEntryEnabled',true,'hasNestedData',false,
          'extractionInstructions',v_curve_extraction_instructions,
          'columns',jsonb_build_array(
            jsonb_build_object('fieldKey','periodo','label','Periodo','dataType','text'),
            jsonb_build_object('fieldKey','avance_mensual_pct','label','Avance Mensual %','dataType','number'),
            jsonb_build_object('fieldKey','avance_acumulado_pct','label','Avance Acumulado %','dataType','number')
          )
        )
      )
    ),
    1,
    null
  ) returning id into v_default_curve_tabla_id;

  insert into public.obra_default_tabla_columns (default_tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_default_curve_tabla_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_default_curve_tabla_id, 'avance_mensual_pct', 'Avance Mensual %', 'number', 1, false, '{}'::jsonb),
    (v_default_curve_tabla_id, 'avance_acumulado_pct', 'Avance Acumulado %', 'number', 2, false, '{}'::jsonb);

  insert into public.obra_default_tablas (tenant_id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id)
  values (
    v_tenant_id,
    'Ordenes de Compra OCR',
    'Extracción de órdenes de compra.',
    'ocr',
    'ordenes-de-compra',
    jsonb_build_object(
      'dataInputMethod', 'both','manualEntryEnabled', true,'spreadsheetTemplate', 'auto',
      'ocrTemplateId', v_orders_template_id,'ocrTemplateName', 'Ordenes de Compra','hasNestedData', true,
      'extractionRowMode', 'single','extractionMaxRows', 1,'extractionDocumentTypes', jsonb_build_array('orden de compra'),
      'documentTypes', jsonb_build_array('orden de compra'),'extractionInstructions', v_orders_extraction_instructions,
      'extractedTables', jsonb_build_array(
        jsonb_build_object(
          'id','ordenes-compra-ocr','name','Ordenes de Compra OCR','rowMode','single','maxRows',1,
          'dataInputMethod','both','spreadsheetTemplate','auto','ocrTemplateId',v_orders_template_id,'ocrTemplateName','Ordenes de Compra',
          'manualEntryEnabled',true,'hasNestedData',true,'documentTypes',jsonb_build_array('orden de compra'),
          'extractionInstructions',v_orders_extraction_instructions,
          'columns',jsonb_build_array(
            jsonb_build_object('fieldKey','nro','label','NRO','dataType','text','ocrScope','parent'),
            jsonb_build_object('fieldKey','solicitante','label','SOLICITANTE','dataType','text','ocrScope','parent'),
            jsonb_build_object('fieldKey','proveedor','label','PROVEEDOR','dataType','text','ocrScope','parent'),
            jsonb_build_object('fieldKey','total_orden','label','TOTAL ORDEN','dataType','text','ocrScope','parent'),
            jsonb_build_object('fieldKey','cantidad','label','Cantidad','dataType','text','ocrScope','item'),
            jsonb_build_object('fieldKey','unidad','label','Unidad','dataType','text','ocrScope','item'),
            jsonb_build_object('fieldKey','detalle_descriptivo','label','DETALLE DESCRIPTIVO','dataType','text','ocrScope','item'),
            jsonb_build_object('fieldKey','precio_unitario','label','PRECIO UNITARIO','dataType','text','ocrScope','item'),
            jsonb_build_object('fieldKey','precio_total','label','PRECIO TOTAL','dataType','text','ocrScope','item')
          )
        )
      )
    ),
    2,
    v_orders_template_id
  ) returning id into v_default_orders_tabla_id;

  insert into public.obra_default_tabla_columns (default_tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_default_orders_tabla_id, 'nro', 'NRO', 'text', 0, false, jsonb_build_object('ocrScope','parent')),
    (v_default_orders_tabla_id, 'solicitante', 'SOLICITANTE', 'text', 1, false, jsonb_build_object('ocrScope','parent')),
    (v_default_orders_tabla_id, 'proveedor', 'PROVEEDOR', 'text', 2, false, jsonb_build_object('ocrScope','parent')),
    (v_default_orders_tabla_id, 'total_orden', 'TOTAL ORDEN', 'text', 3, false, jsonb_build_object('ocrScope','parent')),
    (v_default_orders_tabla_id, 'cantidad', 'Cantidad', 'text', 4, false, jsonb_build_object('ocrScope','item')),
    (v_default_orders_tabla_id, 'unidad', 'Unidad', 'text', 5, false, jsonb_build_object('ocrScope','item')),
    (v_default_orders_tabla_id, 'detalle_descriptivo', 'DETALLE DESCRIPTIVO', 'text', 6, false, jsonb_build_object('ocrScope','item')),
    (v_default_orders_tabla_id, 'precio_unitario', 'PRECIO UNITARIO', 'text', 7, false, jsonb_build_object('ocrScope','item')),
    (v_default_orders_tabla_id, 'precio_total', 'PRECIO TOTAL', 'text', 8, false, jsonb_build_object('ocrScope','item'));

  insert into public.obra_default_tablas (tenant_id, name, description, source_type, linked_folder_path, settings, position, ocr_template_id)
  values (
    v_tenant_id,
    'Nueva tabla extraida',
    'Extracción secundaria de órdenes.',
    'ocr',
    'ordenes-2',
    jsonb_build_object(
      'dataInputMethod', 'both','manualEntryEnabled', true,'spreadsheetTemplate', 'auto',
      'ocrTemplateId', v_orders_template_id,'ocrTemplateName', 'Ordenes de Compra','hasNestedData', true,
      'extractionRowMode', 'single','extractionMaxRows', 1,'extractionDocumentTypes', jsonb_build_array('orden de compra'),
      'documentTypes', jsonb_build_array('orden de compra'),
      'extractedTables', jsonb_build_array(
        jsonb_build_object(
          'id','nueva-tabla-extraida','name','Nueva tabla extraida','rowMode','single','maxRows',1,
          'dataInputMethod','both','spreadsheetTemplate','auto','ocrTemplateId',v_orders_template_id,'ocrTemplateName','Ordenes de Compra',
          'manualEntryEnabled',true,'hasNestedData',true,
          'columns',jsonb_build_array(
            jsonb_build_object('fieldKey','nro','label','NRO','dataType','text','ocrScope','parent'),
            jsonb_build_object('fieldKey','solicitante','label','SOLICITANTE','dataType','text','ocrScope','parent'),
            jsonb_build_object('fieldKey','proveedor','label','PROVEEDOR','dataType','text','ocrScope','parent'),
            jsonb_build_object('fieldKey','total_orden','label','TOTAL ORDEN','dataType','text','ocrScope','parent'),
            jsonb_build_object('fieldKey','cantidad','label','Cantidad','dataType','text','ocrScope','item'),
            jsonb_build_object('fieldKey','unidad','label','Unidad','dataType','text','ocrScope','item'),
            jsonb_build_object('fieldKey','detalle_descriptivo','label','DETALLE DESCRIPTIVO','dataType','text','ocrScope','item'),
            jsonb_build_object('fieldKey','precio_unitario','label','PRECIO UNITARIO','dataType','text','ocrScope','item')
          )
        )
      )
    ),
    3,
    v_orders_template_id
  ) returning id into v_default_orders_2_tabla_id;

  insert into public.obra_default_tabla_columns (default_tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_default_orders_2_tabla_id, 'nro', 'NRO', 'text', 0, false, jsonb_build_object('ocrScope','parent')),
    (v_default_orders_2_tabla_id, 'solicitante', 'SOLICITANTE', 'text', 1, false, jsonb_build_object('ocrScope','parent')),
    (v_default_orders_2_tabla_id, 'proveedor', 'PROVEEDOR', 'text', 2, false, jsonb_build_object('ocrScope','parent')),
    (v_default_orders_2_tabla_id, 'total_orden', 'TOTAL ORDEN', 'text', 3, false, jsonb_build_object('ocrScope','parent')),
    (v_default_orders_2_tabla_id, 'cantidad', 'Cantidad', 'text', 4, false, jsonb_build_object('ocrScope','item')),
    (v_default_orders_2_tabla_id, 'unidad', 'Unidad', 'text', 5, false, jsonb_build_object('ocrScope','item')),
    (v_default_orders_2_tabla_id, 'detalle_descriptivo', 'DETALLE DESCRIPTIVO', 'text', 6, false, jsonb_build_object('ocrScope','item')),
    (v_default_orders_2_tabla_id, 'precio_unitario', 'PRECIO UNITARIO', 'text', 7, false, jsonb_build_object('ocrScope','item'));

  insert into public.obras (tenant_id, n, designacion_y_ubicacion, sup_de_obra_m2, entidad_contratante, mes_basico_de_contrato, iniciacion, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, segun_contrato, prorrogas_acordadas, plazo_total, plazo_transc, porcentaje, custom_data)
  values
    (v_tenant_id, 101, 'Hospital Municipal Norte', 12850, 'Municipalidad de Cordoba', v_prev_three_period, to_char(v_current_month - interval '10 months', 'YYYY-MM-DD'), 156500000, 0, 0, 18, 2, 20, 11, 63.4, jsonb_build_object('project_manager', v_owner_name, 'commercial_stage', 'Live Demo', 'forecast_close', v_forecast_one)),
    (v_tenant_id, 102, 'Centro Logistico Ribera', 9400, 'Grupo Delta', v_prev_two_period, to_char(v_current_month - interval '7 months', 'YYYY-MM-DD'), 89200000, 0, 0, 14, 1, 15, 6, 37.2, jsonb_build_object('project_manager', v_owner_name, 'commercial_stage', 'Qualification', 'forecast_close', v_forecast_two)),
    (v_tenant_id, 103, 'Escuela Tecnica Sur', 6800, 'Ministerio de Educacion', v_prev_one_period, to_char(v_current_month - interval '12 months', 'YYYY-MM-DD'), 110400000, 0, 0, 12, 0, 12, 10, 82.1, jsonb_build_object('project_manager', v_owner_name, 'commercial_stage', 'Proposal Sent', 'forecast_close', v_forecast_three));

  select id into v_obra_101_id from public.obras where tenant_id = v_tenant_id and n = 101;
  select id into v_obra_102_id from public.obras where tenant_id = v_tenant_id and n = 102;
  select id into v_obra_103_id from public.obras where tenant_id = v_tenant_id and n = 103;

  insert into public.obra_tablas (obra_id, name, description, source_type, settings)
  values
    (v_obra_101_id, 'Certificados Extraidos', 'Extracción principal de certificados.', 'ocr', jsonb_build_object('ocrFolder','certificados','defaultTablaId',v_default_cert_tabla_id,'dataInputMethod','both','manualEntryEnabled',true,'spreadsheetTemplate','certificado','ocrTemplateId',v_cert_template_id,'ocrTemplateName','Certificado De Obra')),
    (v_obra_101_id, 'Curva de Avance Manual', 'Tabla destino para la carga manual de la curva de avance desde Documentos.', 'ocr', jsonb_build_object('ocrFolder','curva-de-avance','defaultTablaId',v_default_curve_tabla_id,'dataInputMethod','both','manualEntryEnabled',true,'spreadsheetTemplate','auto')),
    (v_obra_101_id, 'Ordenes de Compra OCR', 'Extracción de órdenes.', 'ocr', jsonb_build_object('ocrFolder','ordenes-de-compra','defaultTablaId',v_default_orders_tabla_id,'dataInputMethod','both','manualEntryEnabled',true,'spreadsheetTemplate','auto','ocrTemplateId',v_orders_template_id,'ocrTemplateName','Ordenes de Compra','hasNestedData',true)),
    (v_obra_101_id, 'Nueva tabla extraida', 'Extracción secundaria de órdenes.', 'ocr', jsonb_build_object('ocrFolder','ordenes-2','defaultTablaId',v_default_orders_2_tabla_id,'dataInputMethod','both','manualEntryEnabled',true,'spreadsheetTemplate','auto','ocrTemplateId',v_orders_template_id,'ocrTemplateName','Ordenes de Compra','hasNestedData',true)),
    (v_obra_101_id, 'PMC Resumen', 'Tabla soporte para reporting demo.', 'manual', jsonb_build_object('spreadsheetPresetKey','pmc_resumen')),
    (v_obra_101_id, 'PMC Items', 'Tabla soporte para reporting demo.', 'manual', jsonb_build_object('spreadsheetPresetKey','pmc_items')),
    (v_obra_101_id, 'Curva Plan', 'Tabla soporte para reporting demo.', 'manual', jsonb_build_object('spreadsheetPresetKey','curva_plan')),
    (v_obra_102_id, 'PMC Resumen', 'Tabla soporte para reporting demo.', 'manual', jsonb_build_object('spreadsheetPresetKey','pmc_resumen')),
    (v_obra_103_id, 'PMC Resumen', 'Tabla soporte para reporting demo.', 'manual', jsonb_build_object('spreadsheetPresetKey','pmc_resumen'));

  select id into v_obra_101_certificados_extraidos_id from public.obra_tablas where obra_id = v_obra_101_id and name = 'Certificados Extraidos';
  select id into v_obra_101_curva_manual_id from public.obra_tablas where obra_id = v_obra_101_id and name = 'Curva de Avance Manual';
  select id into v_obra_101_orders_id from public.obra_tablas where obra_id = v_obra_101_id and name = 'Ordenes de Compra OCR';
  select id into v_obra_101_orders_2_id from public.obra_tablas where obra_id = v_obra_101_id and name = 'Nueva tabla extraida';
  select id into v_obra_101_pmc_resumen_id from public.obra_tablas where obra_id = v_obra_101_id and name = 'PMC Resumen';
  select id into v_obra_101_pmc_items_id from public.obra_tablas where obra_id = v_obra_101_id and name = 'PMC Items';
  select id into v_obra_101_curva_plan_id from public.obra_tablas where obra_id = v_obra_101_id and name = 'Curva Plan';
  select id into v_obra_102_pmc_resumen_id from public.obra_tablas where obra_id = v_obra_102_id and name = 'PMC Resumen';
  select id into v_obra_103_pmc_resumen_id from public.obra_tablas where obra_id = v_obra_103_id and name = 'PMC Resumen';

  insert into public.obra_tabla_columns (tabla_id, field_key, label, data_type, position, required, config)
  values
    (v_obra_101_certificados_extraidos_id, 'nro_certificado', 'NRO CERTIFICADO', 'text', 0, false, '{}'::jsonb),
    (v_obra_101_certificados_extraidos_id, 'periodo', 'PERIODO', 'text', 1, false, '{}'::jsonb),
    (v_obra_101_certificados_extraidos_id, 'fecha_certificacion', 'FECHA CERTIFICACION', 'text', 2, false, '{}'::jsonb),
    (v_obra_101_certificados_extraidos_id, 'nro_expediente', 'NRO EXPEDIENTE', 'text', 3, false, '{}'::jsonb),
    (v_obra_101_certificados_extraidos_id, 'monto_certificado', 'MONTO CERTIFICADO', 'text', 4, false, '{}'::jsonb),
    (v_obra_101_certificados_extraidos_id, 'avance_fisico_acumulado_pct', 'AVANCE FISICO ACUMULADO %', 'text', 5, false, '{}'::jsonb),
    (v_obra_101_certificados_extraidos_id, 'monto_acumulado', 'MONTO ACUMULADO', 'text', 6, false, '{}'::jsonb),
    (v_obra_101_curva_manual_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_101_curva_manual_id, 'avance_mensual_pct', 'Avance Mensual %', 'number', 1, false, '{}'::jsonb),
    (v_obra_101_curva_manual_id, 'avance_acumulado_pct', 'Avance Acumulado %', 'number', 2, false, '{}'::jsonb),
    (v_obra_101_orders_id, 'nro', 'NRO', 'text', 0, false, jsonb_build_object('ocrScope','parent')),
    (v_obra_101_orders_id, 'solicitante', 'SOLICITANTE', 'text', 1, false, jsonb_build_object('ocrScope','parent')),
    (v_obra_101_orders_id, 'proveedor', 'PROVEEDOR', 'text', 2, false, jsonb_build_object('ocrScope','parent')),
    (v_obra_101_orders_id, 'total_orden', 'TOTAL ORDEN', 'text', 3, false, jsonb_build_object('ocrScope','parent')),
    (v_obra_101_orders_id, 'cantidad', 'Cantidad', 'text', 4, false, jsonb_build_object('ocrScope','item')),
    (v_obra_101_orders_id, 'unidad', 'Unidad', 'text', 5, false, jsonb_build_object('ocrScope','item')),
    (v_obra_101_orders_id, 'detalle_descriptivo', 'DETALLE DESCRIPTIVO', 'text', 6, false, jsonb_build_object('ocrScope','item')),
    (v_obra_101_orders_id, 'precio_unitario', 'PRECIO UNITARIO', 'text', 7, false, jsonb_build_object('ocrScope','item')),
    (v_obra_101_orders_id, 'precio_total', 'PRECIO TOTAL', 'text', 8, false, jsonb_build_object('ocrScope','item')),
    (v_obra_101_orders_2_id, 'nro', 'NRO', 'text', 0, false, jsonb_build_object('ocrScope','parent')),
    (v_obra_101_orders_2_id, 'solicitante', 'SOLICITANTE', 'text', 1, false, jsonb_build_object('ocrScope','parent')),
    (v_obra_101_orders_2_id, 'proveedor', 'PROVEEDOR', 'text', 2, false, jsonb_build_object('ocrScope','parent')),
    (v_obra_101_orders_2_id, 'total_orden', 'TOTAL ORDEN', 'text', 3, false, jsonb_build_object('ocrScope','parent')),
    (v_obra_101_orders_2_id, 'cantidad', 'Cantidad', 'text', 4, false, jsonb_build_object('ocrScope','item')),
    (v_obra_101_orders_2_id, 'unidad', 'Unidad', 'text', 5, false, jsonb_build_object('ocrScope','item')),
    (v_obra_101_orders_2_id, 'detalle_descriptivo', 'DETALLE DESCRIPTIVO', 'text', 6, false, jsonb_build_object('ocrScope','item')),
    (v_obra_101_orders_2_id, 'precio_unitario', 'PRECIO UNITARIO', 'text', 7, false, jsonb_build_object('ocrScope','item')),
    (v_obra_101_pmc_resumen_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'nro_certificado', 'Nro Certificado', 'text', 1, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'fecha_certificacion', 'Fecha Certificacion', 'text', 2, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'monto_certificado', 'Monto Certificado', 'currency', 3, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'avance_fisico_acumulado_pct', 'Avance Fisico Acumulado %', 'number', 4, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'monto_acumulado', 'Monto Acumulado', 'currency', 5, false, '{}'::jsonb),
    (v_obra_101_pmc_resumen_id, 'n_expediente', 'Nro Expediente', 'text', 6, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'item_code', 'Codigo Item', 'text', 0, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'descripcion', 'Descripcion', 'text', 1, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'incidencia_pct', 'Incidencia %', 'number', 2, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'monto_rubro', 'Monto Rubro', 'currency', 3, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'avance_anterior_pct', 'Avance Anterior %', 'number', 4, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'avance_periodo_pct', 'Avance Periodo %', 'number', 5, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'avance_acumulado_pct', 'Avance Acumulado %', 'number', 6, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'monto_anterior', 'Monto Anterior', 'currency', 7, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'monto_presente', 'Monto Presente', 'currency', 8, false, '{}'::jsonb),
    (v_obra_101_pmc_items_id, 'monto_acumulado', 'Monto Acumulado', 'currency', 9, false, '{}'::jsonb),
    (v_obra_101_curva_plan_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_101_curva_plan_id, 'avance_mensual_pct', 'Avance Mensual %', 'number', 1, false, '{}'::jsonb),
    (v_obra_101_curva_plan_id, 'avance_acumulado_pct', 'Avance Acumulado %', 'number', 2, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'nro_certificado', 'Nro Certificado', 'text', 1, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'fecha_certificacion', 'Fecha Certificacion', 'text', 2, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'monto_certificado', 'Monto Certificado', 'currency', 3, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'avance_fisico_acumulado_pct', 'Avance Fisico Acumulado %', 'number', 4, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'monto_acumulado', 'Monto Acumulado', 'currency', 5, false, '{}'::jsonb),
    (v_obra_102_pmc_resumen_id, 'n_expediente', 'Nro Expediente', 'text', 6, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'periodo', 'Periodo', 'text', 0, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'nro_certificado', 'Nro Certificado', 'text', 1, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'fecha_certificacion', 'Fecha Certificacion', 'text', 2, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'monto_certificado', 'Monto Certificado', 'currency', 3, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'avance_fisico_acumulado_pct', 'Avance Fisico Acumulado %', 'number', 4, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'monto_acumulado', 'Monto Acumulado', 'currency', 5, false, '{}'::jsonb),
    (v_obra_103_pmc_resumen_id, 'n_expediente', 'Nro Expediente', 'text', 6, false, '{}'::jsonb);

  insert into public.obra_tabla_rows (tabla_id, data, source)
  values
    (v_obra_101_pmc_resumen_id, jsonb_build_object('periodo', v_prev_two_period, 'nro_certificado', '11', 'fecha_certificacion', v_prev_two_period || '-27', 'monto_certificado', 18650000, 'avance_fisico_acumulado_pct', 49.8, 'monto_acumulado', 77110000, 'n_expediente', 'EXP-2026-014'), 'seed'),
    (v_obra_101_pmc_resumen_id, jsonb_build_object('periodo', v_prev_one_period, 'nro_certificado', '12', 'fecha_certificacion', v_prev_one_period || '-28', 'monto_certificado', 22100000, 'avance_fisico_acumulado_pct', 63.4, 'monto_acumulado', 99210000, 'n_expediente', 'EXP-2026-014'), 'seed'),
    (v_obra_102_pmc_resumen_id, jsonb_build_object('periodo', v_prev_one_period, 'nro_certificado', '08', 'fecha_certificacion', v_prev_one_period || '-26', 'monto_certificado', 9800000, 'avance_fisico_acumulado_pct', 37.2, 'monto_acumulado', 33182400, 'n_expediente', 'DLT-882/2026'), 'seed'),
    (v_obra_103_pmc_resumen_id, jsonb_build_object('periodo', v_prev_one_period, 'nro_certificado', '15', 'fecha_certificacion', v_prev_one_period || '-25', 'monto_certificado', 14300000, 'avance_fisico_acumulado_pct', 82.1, 'monto_acumulado', 90638400, 'n_expediente', 'MINED-410/2026'), 'seed'),
    (v_obra_101_pmc_items_id, jsonb_build_object('item_code', '01.01', 'descripcion', 'Movimiento de suelo', 'incidencia_pct', 18.4, 'monto_rubro', 28800000, 'avance_anterior_pct', 68, 'avance_periodo_pct', 7, 'avance_acumulado_pct', 75, 'monto_anterior', 23500000, 'monto_presente', 5300000, 'monto_acumulado', 28800000), 'seed'),
    (v_obra_101_pmc_items_id, jsonb_build_object('item_code', '03.02', 'descripcion', 'Estructura de hormigon', 'incidencia_pct', 42.7, 'monto_rubro', 66800000, 'avance_anterior_pct', 54, 'avance_periodo_pct', 9.4, 'avance_acumulado_pct', 63.4, 'monto_anterior', 56900000, 'monto_presente', 9900000, 'monto_acumulado', 66800000), 'seed'),
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 1', 'avance_mensual_pct', 8, 'avance_acumulado_pct', 8), 'seed'),
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 2', 'avance_mensual_pct', 11, 'avance_acumulado_pct', 19), 'seed'),
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 3', 'avance_mensual_pct', 13, 'avance_acumulado_pct', 32), 'seed'),
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 4', 'avance_mensual_pct', 14, 'avance_acumulado_pct', 46), 'seed'),
    (v_obra_101_curva_plan_id, jsonb_build_object('periodo', 'Mes 5', 'avance_mensual_pct', 17.4, 'avance_acumulado_pct', 63.4), 'seed');

  insert into public.obra_rule_config (tenant_id, obra_id, config_json, updated_at)
  values (
    v_tenant_id,
    v_obra_101_id,
    jsonb_build_object(
      'enabledPacks', jsonb_build_object('curve', true, 'unpaidCerts', false, 'inactivity', false, 'monthlyMissingCert', true, 'stageStalled', false),
      'mappings', jsonb_build_object(
        'curve', jsonb_build_object('planTableId', v_obra_101_curva_plan_id, 'resumenTableId', v_obra_101_pmc_resumen_id, 'actualPctColumnKey', 'avance_fisico_acumulado_pct', 'plan', jsonb_build_object('startPeriod', v_curve_start_period)),
        'monthlyMissingCert', jsonb_build_object('certTableId', v_obra_101_pmc_resumen_id, 'certIssuedAtColumnKey', 'fecha_certificacion')
      ),
      'thresholds', jsonb_build_object('curve', jsonb_build_object('warnBelow', 10, 'criticalBelow', 20), 'unpaidCerts', jsonb_build_object('severity', 'warn'), 'inactivity', jsonb_build_object('severity', 'warn'), 'monthlyMissingCert', jsonb_build_object('severity', 'warn'), 'stageStalled', jsonb_build_object('severity', 'warn'))
    ),
    now()
  );

  insert into public.obra_findings (tenant_id, obra_id, period_key, rule_key, severity, title, message, evidence_json, status)
  values
    (v_tenant_id, v_obra_101_id, v_current_period, 'cert.missing_current_month', 'warn', 'Falta certificado del mes actual', 'Se detectaron certificados en meses anteriores pero falta el certificado del periodo ' || v_current_period || '.', jsonb_build_object('period', v_current_period), 'open'),
    (v_tenant_id, v_obra_101_id, v_current_period, 'curve.critical_below_plan', 'critical', 'Desvio critico en curva', 'El avance esta 50.1 puntos por debajo del plan.', jsonb_build_object('belowPlanPoints', 50.1, 'period', v_current_period), 'open');

  insert into public.macro_tables (tenant_id, name, description, settings)
  values (v_tenant_id, 'Tablas', 'Vista agregada de certificados PMC Resumen para demo.', jsonb_build_object('seededBy', 'ilag-demo-db-only-seed'))
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

  insert into public.tenant_demo_links (tenant_id, slug, label, token_hash, allowed_capabilities, created_by)
  values (
    v_tenant_id,
    v_demo_slug,
    v_demo_label,
    encode(digest(v_demo_token, 'sha256'), 'hex'),
    '["dashboard","excel","macro"]'::jsonb,
    v_owner_user_id
  ) returning id into v_demo_link_id;

  raise notice 'Demo tenant created: % (%)', v_tenant_name, v_tenant_id;
  raise notice 'Demo URL: %/demo/%?token=%', trim(trailing '/' from v_base_url), v_demo_slug, v_demo_token;
  raise notice 'Owner membership created for % (%).', v_owner_email, v_owner_user_id;
  raise notice 'Storage-backed document previews are not seeded by this SQL.';
end
$$;
