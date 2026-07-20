/**
 * Pure helpers for the file manager: file-type detection, formatting,
 * folder-tree manipulation, guided-tour target ids, and OCR table-link
 * selection heuristics.
 *
 * Everything here is stateless. Tree helpers (`upsertFilesIntoFolderTree`,
 * `sortFileManagerChildren`) return new nodes and never mutate the input
 * tree — the file manager relies on reference changes for re-rendering.
 */
import { normalizeFolderName, normalizeFolderPath, toNumericValue } from '@/lib/tablas';

import type { FileSystemItem, OcrFolderLink } from './types';

export const IMAGE_FILE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'heic',
  'heif',
]);
export const MODEL_FILE_EXTENSIONS = new Set(['nwc', 'nwd', 'rvt', 'dwg', 'ifc', 'zip']);

// Utility function to check if a file is a 3D model
export const is3DModelFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return MODEL_FILE_EXTENSIONS.has(ext || '');
};

export function getLegacyOrderString(
  data: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

export function getLegacyOrderNumber(
  data: Record<string, unknown>,
  keys: string[],
): number {
  for (const key of keys) {
    const value = data[key];
    const parsed = Number(value ?? 0);
    if (Number.isFinite(parsed) && parsed !== 0) {
      return parsed;
    }
  }
  return 0;
}

export function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export function formatRecoveryTimeLeft(value: string | null | undefined) {
  if (!value) return 'Sin fecha';
  const deadline = new Date(value).getTime();
  if (!Number.isFinite(deadline)) return 'Sin fecha';
  const diffMs = deadline - Date.now();
  if (diffMs <= 0) return 'Expirada';
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return `${diffHours}h restantes`;
  const diffDays = Math.ceil(diffHours / 24);
  return `${diffDays}d restantes`;
}

export function extractRequestError(error: unknown): { message: string; code: string | null } {
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; code?: unknown };
    return {
      message:
        typeof maybeError.message === 'string' && maybeError.message.trim().length > 0
          ? maybeError.message
          : 'Error desconocido',
      code: typeof maybeError.code === 'string' ? maybeError.code : null,
    };
  }
  if (error instanceof Error) {
    return { message: error.message, code: null };
  }
  return { message: 'Error desconocido', code: null };
}

export function getConditionalClass(
  value: unknown,
  config?: Record<string, unknown>
): string | undefined {
  const conditional =
    config?.conditional && typeof config.conditional === 'object'
      ? (config.conditional as Record<string, unknown>)
      : null;
  if (!conditional) return undefined;
  const numeric = toNumericValue(value);
  if (numeric == null) return undefined;
  const criticalBelow = toNumericValue(conditional.criticalBelow);
  const criticalAbove = toNumericValue(conditional.criticalAbove);
  const warnBelow = toNumericValue(conditional.warnBelow);
  const warnAbove = toNumericValue(conditional.warnAbove);
  if (criticalBelow != null && numeric <= criticalBelow) return 'bg-red-100 text-red-800';
  if (criticalAbove != null && numeric >= criticalAbove) return 'bg-red-100 text-red-800';
  if (warnBelow != null && numeric <= warnBelow) return 'bg-amber-100 text-amber-800';
  if (warnAbove != null && numeric >= warnAbove) return 'bg-amber-100 text-amber-800';
  return undefined;
}

export function getFolderSegmentKey(folder: FileSystemItem): string {
  if (folder.type !== 'folder') return '';
  if (typeof folder.relativePath === 'string' && folder.relativePath.trim().length > 0) {
    return normalizeFolderPath(folder.relativePath).split('/').filter(Boolean).pop() ?? '';
  }
  return normalizeFolderName(folder.name);
}

export function getGuidedDocumentsFolderTargetId(folderName: string): string | undefined {
  const normalized = normalizeFolderName(folderName);
  if (normalized === 'certificados') return 'documents-folder-certificados';
  if (normalized === 'curva-de-avance') return 'documents-folder-curva-avance';
  if (normalized === 'ordenes-de-compra') return 'documents-folder-ordenes-compra';
  if (normalized === 'fotos-de-obra') return 'documents-folder-fotos-obra';
  if (normalized === 'presupuesto-personalizado') return 'documents-folder-presupuesto-personalizado';
  return undefined;
}

export function getAutoSelectedCertificadoOcrTablaIds(links: OcrFolderLink[]): string[] {
  const uniqueLinks = Array.from(new Map(links.map((link) => [link.tablaId, link])).values());
  if (uniqueLinks.length === 0) return [];

  const pmcResumenLink = uniqueLinks.find((link) => getCertificadoTableSelectorScore(link) === 0);
  if (!pmcResumenLink) return [];

  const hasCertificadoCompanionTable = uniqueLinks.some((link) => {
    const score = getCertificadoTableSelectorScore(link);
    return score === 1 || score === 2;
  });

  return hasCertificadoCompanionTable ? [pmcResumenLink.tablaId] : [];
}

export function getCertificadoTableSelectorScore(link: OcrFolderLink): number | null {
  const normalizedName = normalizeFolderName(link.tablaName ?? '');
  if (normalizedName.includes('pmc-resumen')) return 0;
  if (normalizedName.includes('pmc-items')) return 1;
  if (normalizedName.includes('curva-plan')) return 2;

  const fieldKeys = new Set(link.columns.map((column) => column.fieldKey));
  const looksLikeResumen =
    fieldKeys.has('monto_certificado') &&
    (fieldKeys.has('monto_acumulado') || fieldKeys.has('avance_fisico_acumulado_pct'));
  const looksLikeItems =
    (fieldKeys.has('item_code') || fieldKeys.has('descripcion')) &&
    (fieldKeys.has('avance_periodo_pct') || fieldKeys.has('monto_presente'));
  const looksLikePlan =
    fieldKeys.has('periodo') &&
    fieldKeys.has('avance_mensual_pct') &&
    fieldKeys.has('avance_acumulado_pct');

  if (looksLikeResumen) return 0;
  if (looksLikeItems) return 1;
  if (looksLikePlan) return 2;
  return null;
}

export function sortTableLinksForSelector(links: OcrFolderLink[]): OcrFolderLink[] {
  if (links.length <= 1) return links;

  const certificadoScores = links.map((link, index) => ({
    index,
    link,
    score: getCertificadoTableSelectorScore(link),
  }));
  if (certificadoScores.some((entry) => entry.score !== null)) {
    return certificadoScores
      .toSorted((left, right) => {
        const leftScore = left.score ?? 99;
        const rightScore = right.score ?? 99;
        if (leftScore !== rightScore) return leftScore - rightScore;
        return left.index - right.index;
      })
      .map((entry) => entry.link);
  }

  const hasPresupuesto = links.some((link) => normalizeFolderName(link.tablaName ?? '').includes('presupuesto'));
  const hasMateriales = links.some((link) => normalizeFolderName(link.tablaName ?? '').includes('material'));

  if (!hasPresupuesto || !hasMateriales) return links;

  const score = (link: OcrFolderLink) => {
    const normalized = normalizeFolderName(link.tablaName ?? '');
    if (normalized.includes('presupuesto')) return 0;
    if (normalized.includes('material')) return 1;
    return 2;
  };

  return links.toSorted((left, right) => {
    const scoreDiff = score(left) - score(right);
    if (scoreDiff !== 0) return scoreDiff;
    return (left.tablaName ?? '').localeCompare(right.tablaName ?? '', 'es', { sensitivity: 'base' });
  });
}

export function sortFileManagerChildren(children: FileSystemItem[]) {
  return [...children].sort((left, right) => {
    if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;
    return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' });
  });
}

export function upsertFilesIntoFolderTree(
  tree: FileSystemItem,
  folderId: string,
  files: FileSystemItem[],
  markFolderLoaded: boolean
): FileSystemItem {
  if (files.length === 0) return tree;

  const upsertIntoFolder = (folder: FileSystemItem) => {
    const currentChildren = folder.children ?? [];
    const incomingPaths = new Set(files.map((file) => file.storagePath).filter(Boolean));
    const incomingIds = new Set(files.map((file) => file.id));
    const preservedChildren = currentChildren.filter((child) => {
      if (child.type !== 'file') return true;
      if (incomingIds.has(child.id)) return false;
      return !child.storagePath || !incomingPaths.has(child.storagePath);
    });
    const nextChildren = sortFileManagerChildren([...preservedChildren, ...files]);
    const fileCount = nextChildren.filter((child) => child.type === 'file').length;
    return {
      ...folder,
      children: nextChildren,
      childrenLoaded: markFolderLoaded || folder.childrenLoaded,
      hasFiles: fileCount > 0 || Boolean(folder.hasFiles),
      fileCount,
    };
  };

  if (tree.id === folderId) {
    return upsertIntoFolder(tree);
  }

  const walk = (node: FileSystemItem): FileSystemItem => {
    if (node.type !== 'folder' || !node.children) return node;
    let changed = false;
    const nextChildren = node.children.map((child) => {
      if (child.id === folderId && child.type === 'folder') {
        changed = true;
        return upsertIntoFolder(child);
      }
      const nextChild = walk(child);
      if (nextChild !== child) changed = true;
      return nextChild;
    });
    return changed ? { ...node, children: nextChildren } : node;
  };

  return walk(tree);
}
