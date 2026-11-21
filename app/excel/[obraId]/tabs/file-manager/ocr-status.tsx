/**
 * OCR document-status presentation: status → icon/label/tone mapping, the
 * status badge, and import-failure toasts.
 *
 * Error codes are a contract with the import routes: the stable code
 * `LINEAGE_RECONCILIATION_CONFLICT` gets its own badge and toast copy so
 * lineage conflicts surface as such (never as a generic OCR failure). Keep
 * new failure modes keyed by stable code, not by message text.
 */
import { AlertCircle, CheckCircle2, Clock, Loader2, XIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { FileSystemItem } from './types';

export type OcrStatusBadgeContext = "tree" | "thumbnail" | "sheet";

export type OcrStatusMeta = {
  icon: typeof CheckCircle2;
  label: string;
  shortLabel: string;
  tooltip: string;
  variant: BadgeProps["variant"];
};

export function getOcrStatusMeta(item: FileSystemItem): OcrStatusMeta | null {
  if (item.type !== 'file' || !item.ocrDocumentStatus) return null;

  const rowsExtracted =
    typeof item.ocrRowsExtracted === 'number' && Number.isFinite(item.ocrRowsExtracted)
      ? item.ocrRowsExtracted
      : null;

  switch (item.ocrDocumentStatus) {
    case 'completed':
      if (rowsExtracted !== null && rowsExtracted <= 0) {
        return {
          icon: AlertCircle,
          label: 'Sin datos extraidos',
          shortLabel: 'Sin datos',
          tooltip: 'La extraccion termino pero no se encontraron datos.',
          variant: "destructive",
        };
      }

      return {
        icon: CheckCircle2,
        label: rowsExtracted && rowsExtracted > 0 ? `${rowsExtracted} dato${rowsExtracted === 1 ? '' : 's'} extraidos` : 'Datos extraidos',
        shortLabel: 'Extraido',
        tooltip:
          rowsExtracted && rowsExtracted > 0
            ? `Extraccion completada con ${rowsExtracted} dato${rowsExtracted === 1 ? '' : 's'} detectados.`
            : 'Extraccion completada correctamente.',
        variant: "success",
      };
    case 'failed':
      if (item.ocrErrorCode === 'LINEAGE_RECONCILIATION_CONFLICT') {
        return {
          icon: AlertCircle,
          label: 'Conflicto de lineage',
          shortLabel: 'Conflicto',
          tooltip:
            item.ocrDocumentError?.trim() ||
            'No se pudo reconciliar la identidad estable del documento. Revisá filas duplicadas o reprocesá con otra configuración.',
          variant: "destructive",
        };
      }
      return {
        icon: AlertCircle,
        label: 'Error de OCR',
        shortLabel: 'Error OCR',
        tooltip: item.ocrDocumentError?.trim() || 'La extraccion fallo y no se pudieron obtener datos.',
        variant: "destructive",
      };
    case 'processing':
      return {
        icon: Loader2,
        label: 'Extrayendo datos',
        shortLabel: 'Procesando',
        tooltip: 'La extraccion OCR esta en proceso.',
        variant: "info",
      };
    case 'pending':
      return {
        icon: Clock,
        label: 'Pendiente de OCR',
        shortLabel: 'Pendiente',
        tooltip: 'El documento esta esperando procesamiento OCR.',
        variant: "warning",
      };
    case 'unprocessed':
      return {
        icon: XIcon,
        label: 'Sin extraer',
        shortLabel: 'Sin OCR',
        tooltip: 'Todavia no se ejecuto la extraccion de datos para este documento.',
        variant: "neutral",
      };
    default:
      return null;
  }
}

export function notifyOcrImportFailure({
  status,
  code,
  serverMessage,
  fallbackMessage,
}: {
  status: number;
  code?: string | null;
  serverMessage?: string | null;
  fallbackMessage: string;
}) {
  if (code === 'LINEAGE_RECONCILIATION_CONFLICT') {
    toast.error(
      serverMessage ??
      'Hubo un conflicto de continuidad. El documento no se reconcilio automaticamente con la materializacion anterior. Revisá Lineage o corregí la identidad antes de reprocesar.'
    );
    return;
  }

  if (status === 413) {
    toast.warning(
      serverMessage ??
      'El archivo o las paginas seleccionadas son demasiado grandes para OCR. Probá con menos paginas.'
    );
    return;
  }

  if (status === 402) {
    toast.warning(serverMessage ?? 'Superaste el limite de tokens de IA de tu plan.');
    return;
  }

  toast.error(serverMessage ?? fallbackMessage);
}

export function renderOcrStatusBadge(item: FileSystemItem, context: OcrStatusBadgeContext = 'tree') {
  const meta = getOcrStatusMeta(item);
  if (!meta) return null;

  const Icon = meta.icon;
  const label = context === 'sheet' ? meta.label : meta.shortLabel;
  const className = cn(
    'font-semibold',
    context === 'tree' && 'size-6 justify-center p-0 shadow-none',
    context === 'thumbnail' && 'min-h-7 gap-1.5 px-2.5 py-1 text-[11px] uppercase tracking-[0.08em]',
    context === 'sheet' && 'min-h-8 gap-2 px-3 py-1.5 text-xs tracking-[0.08em] uppercase'
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={meta.variant} shape="pill" className={className} aria-label={meta.label}>
          <Icon className={cn('size-3.5 shrink-0', meta.icon === Loader2 && 'animate-spin')} />
          {context !== 'tree' && <span>{label}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{meta.tooltip}</TooltipContent>
    </Tooltip>
  );
}
