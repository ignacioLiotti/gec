-- Extend audit logging to macro tables and default/template configuration tables

DROP TRIGGER IF EXISTS audit_log_macro_tables ON public.macro_tables;
CREATE TRIGGER audit_log_macro_tables
AFTER INSERT OR UPDATE OR DELETE ON public.macro_tables
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

DROP TRIGGER IF EXISTS audit_log_macro_table_sources ON public.macro_table_sources;
CREATE TRIGGER audit_log_macro_table_sources
AFTER INSERT OR UPDATE OR DELETE ON public.macro_table_sources
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('fk:macro_tables:macro_table_id', 'id');

DROP TRIGGER IF EXISTS audit_log_macro_table_columns ON public.macro_table_columns;
CREATE TRIGGER audit_log_macro_table_columns
AFTER INSERT OR UPDATE OR DELETE ON public.macro_table_columns
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('fk:macro_tables:macro_table_id', 'id');

DROP TRIGGER IF EXISTS audit_log_macro_table_custom_values ON public.macro_table_custom_values;
CREATE TRIGGER audit_log_macro_table_custom_values
AFTER INSERT OR UPDATE OR DELETE ON public.macro_table_custom_values
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('fk:macro_tables:macro_table_id', 'id');

DROP TRIGGER IF EXISTS audit_log_sidebar_macro_tables ON public.sidebar_macro_tables;
CREATE TRIGGER audit_log_sidebar_macro_tables
AFTER INSERT OR UPDATE OR DELETE ON public.sidebar_macro_tables
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('fk:roles:role_id', 'id');

DROP TRIGGER IF EXISTS audit_log_obra_default_folders ON public.obra_default_folders;
CREATE TRIGGER audit_log_obra_default_folders
AFTER INSERT OR UPDATE OR DELETE ON public.obra_default_folders
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

DROP TRIGGER IF EXISTS audit_log_obra_default_tablas ON public.obra_default_tablas;
CREATE TRIGGER audit_log_obra_default_tablas
AFTER INSERT OR UPDATE OR DELETE ON public.obra_default_tablas
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

DROP TRIGGER IF EXISTS audit_log_obra_default_tabla_columns ON public.obra_default_tabla_columns;
CREATE TRIGGER audit_log_obra_default_tabla_columns
AFTER INSERT OR UPDATE OR DELETE ON public.obra_default_tabla_columns
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('fk:obra_default_tablas:default_tabla_id', 'id');

DROP TRIGGER IF EXISTS audit_log_ocr_templates ON public.ocr_templates;
CREATE TRIGGER audit_log_ocr_templates
AFTER INSERT OR UPDATE OR DELETE ON public.ocr_templates
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

DROP TRIGGER IF EXISTS audit_log_tenant_main_table_configs ON public.tenant_main_table_configs;
CREATE TRIGGER audit_log_tenant_main_table_configs
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_main_table_configs
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'tenant_id');
