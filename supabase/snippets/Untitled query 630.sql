select count(*) as templates from public.ocr_templates;
select id, tenant_id, name, template_bucket, template_path, is_active
from public.ocr_templates
order by created_at desc
limit 20;
