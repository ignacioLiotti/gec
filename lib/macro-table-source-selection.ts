type MacroSourceMode = "manual" | "template";

export type MacroSourceTablaRecord = {
  id: string;
  name: string;
  defaultTablaId: string | null;
  obraId?: string;
  obraName?: string;
};

export type MacroSourceSelectionSettings = Record<string, unknown> & {
  sourceMode: MacroSourceMode;
  sourceTemplateId: string | null;
  sourceTemplateName: string | null;
  sourceTemplateTableNames: string[];
};

const TEMPLATE_SEPARATORS = [" · ", " - ", " — ", " – ", "|", "/"];

function toSettingsRecord(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }
  return { ...(settings as Record<string, unknown>) };
}

function uniqueStrings(values: unknown): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function normalizeMacroTemplateName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function extractMacroTemplateBaseName(name: string): string {
  const normalized = name.trim();
  for (const separator of TEMPLATE_SEPARATORS) {
    const idx = normalized.lastIndexOf(separator);
    if (idx > -1 && idx + separator.length < normalized.length) {
      return normalized.slice(idx + separator.length).trim();
    }
  }
  return normalized;
}

export function matchesMacroTemplateName(tableName: string, templateName: string): boolean {
  const tableNorm = normalizeMacroTemplateName(tableName);
  const tableBaseNorm = normalizeMacroTemplateName(extractMacroTemplateBaseName(tableName));
  const templateNorm = normalizeMacroTemplateName(templateName);
  return (
    tableNorm === templateNorm ||
    tableBaseNorm === templateNorm ||
    tableNorm.endsWith(` ${templateNorm}`) ||
    tableNorm.endsWith(`· ${templateNorm}`)
  );
}

function dedupeTablas(tablas: MacroSourceTablaRecord[]): MacroSourceTablaRecord[] {
  const seen = new Set<string>();
  return tablas.filter((tabla) => {
    if (!tabla.id || seen.has(tabla.id)) return false;
    seen.add(tabla.id);
    return true;
  });
}

export function buildMacroSourceSelectionSettings(
  settings: unknown,
  explicitSourceTablas: MacroSourceTablaRecord[]
): MacroSourceSelectionSettings {
  const baseSettings = toSettingsRecord(settings);
  const sourceMode =
    baseSettings.sourceMode === "template" || baseSettings.sourceMode === "manual"
      ? (baseSettings.sourceMode as MacroSourceMode)
      : null;
  const sourceTemplateId =
    typeof baseSettings.sourceTemplateId === "string" && baseSettings.sourceTemplateId.trim()
      ? baseSettings.sourceTemplateId.trim()
      : null;
  const sourceTemplateName =
    typeof baseSettings.sourceTemplateName === "string" && baseSettings.sourceTemplateName.trim()
      ? baseSettings.sourceTemplateName.trim()
      : null;
  const sourceTemplateTableNames = uniqueStrings(baseSettings.sourceTemplateTableNames);

  if (sourceMode === "template" && (sourceTemplateId || sourceTemplateName)) {
    return {
      ...baseSettings,
      sourceMode: "template",
      sourceTemplateId,
      sourceTemplateName,
      sourceTemplateTableNames,
    };
  }

  if (sourceMode === "manual") {
    return {
      ...baseSettings,
      sourceMode: "manual",
      sourceTemplateId: null,
      sourceTemplateName: null,
      sourceTemplateTableNames: [],
    };
  }

  const dedupedSources = dedupeTablas(explicitSourceTablas);
  const templateIds = [...new Set(dedupedSources.map((tabla) => tabla.defaultTablaId).filter(Boolean))];

  if (
    dedupedSources.length > 0 &&
    templateIds.length === 1 &&
    dedupedSources.every((tabla) => tabla.defaultTablaId === templateIds[0])
  ) {
    return {
      ...baseSettings,
      sourceMode: "template",
      sourceTemplateId: templateIds[0] ?? null,
      sourceTemplateName,
      sourceTemplateTableNames: uniqueStrings(
        dedupedSources.map((tabla) => extractMacroTemplateBaseName(tabla.name))
      ),
    };
  }

  return {
    ...baseSettings,
    sourceMode: "manual",
    sourceTemplateId: null,
    sourceTemplateName: null,
    sourceTemplateTableNames: [],
  };
}

export function resolveMacroSourceTablas(args: {
  settings: unknown;
  explicitSourceTablas: MacroSourceTablaRecord[];
  candidateTablas?: MacroSourceTablaRecord[];
}): MacroSourceTablaRecord[] {
  const { settings, explicitSourceTablas, candidateTablas = [] } = args;
  const normalizedSettings = buildMacroSourceSelectionSettings(settings, explicitSourceTablas);
  const dedupedExplicitSources = dedupeTablas(explicitSourceTablas);

  if (normalizedSettings.sourceMode !== "template") {
    return dedupedExplicitSources;
  }

  const allowedBaseNames = new Set(
    normalizedSettings.sourceTemplateTableNames.map((name) => normalizeMacroTemplateName(name))
  );

  const resolvedCandidates = dedupeTablas(candidateTablas).filter((tabla) => {
    const matchesTemplateId = normalizedSettings.sourceTemplateId
      ? tabla.defaultTablaId === normalizedSettings.sourceTemplateId
      : false;
    const matchesTemplateName = normalizedSettings.sourceTemplateName
      ? matchesMacroTemplateName(tabla.name, normalizedSettings.sourceTemplateName)
      : false;

    if (!matchesTemplateId && !matchesTemplateName) {
      return false;
    }

    if (allowedBaseNames.size === 0) {
      return true;
    }

    return allowedBaseNames.has(
      normalizeMacroTemplateName(extractMacroTemplateBaseName(tabla.name))
    );
  });

  if (resolvedCandidates.length === 0) {
    return dedupedExplicitSources;
  }

  return dedupeTablas([...dedupedExplicitSources, ...resolvedCandidates]);
}
