-- Audit uploads/deletes tracked in obra_document_uploads

DROP TRIGGER IF EXISTS audit_log_obra_document_uploads ON public.obra_document_uploads;
CREATE TRIGGER audit_log_obra_document_uploads
AFTER INSERT OR UPDATE OR DELETE ON public.obra_document_uploads
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('fk:obras:obra_id', 'id');
