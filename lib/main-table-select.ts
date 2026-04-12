import { normalizeTextForDetection } from "@/lib/tablas";

export type MainTableSelectOptionColor =
	| "slate"
	| "blue"
	| "green"
	| "amber"
	| "red"
	| "violet";

export type MainTableSelectOptionIcon =
	| "dot"
	| "check"
	| "clock"
	| "alert"
	| "x"
	| "pause"
	| "play"
	| "flag"
	| "star"
	| "bookmark"
	| "bell"
	| "wrench"
	| "shield"
	| "info"
	| "ban"
	| "package"
	| "truck"
	| "calendar"
	| "user"
	| "file"
	| "link";

export type MainTableSelectOption = {
	text: string;
	color?: MainTableSelectOptionColor;
	icon?: MainTableSelectOptionIcon;
};

export const MAIN_TABLE_SELECT_COLOR_OPTIONS: Array<{
	value: MainTableSelectOptionColor;
	label: string;
}> = [
	{ value: "slate", label: "Gris" },
	{ value: "blue", label: "Azul" },
	{ value: "green", label: "Verde" },
	{ value: "amber", label: "Ambar" },
	{ value: "red", label: "Rojo" },
	{ value: "violet", label: "Violeta" },
];

export const MAIN_TABLE_SELECT_ICON_OPTIONS: Array<{
	value: MainTableSelectOptionIcon;
	label: string;
}> = [
	{ value: "dot", label: "Punto" },
	{ value: "check", label: "Check" },
	{ value: "clock", label: "Reloj" },
	{ value: "alert", label: "Alerta" },
	{ value: "x", label: "Cruz" },
	{ value: "pause", label: "Pausa" },
	{ value: "play", label: "Play" },
	{ value: "flag", label: "Bandera" },
	{ value: "star", label: "Estrella" },
	{ value: "bookmark", label: "Marcador" },
	{ value: "bell", label: "Campana" },
	{ value: "wrench", label: "Herramienta" },
	{ value: "shield", label: "Escudo" },
	{ value: "info", label: "Info" },
	{ value: "ban", label: "Bloqueado" },
	{ value: "package", label: "Paquete" },
	{ value: "truck", label: "Camion" },
	{ value: "calendar", label: "Calendario" },
	{ value: "user", label: "Usuario" },
	{ value: "file", label: "Archivo" },
	{ value: "link", label: "Enlace" },
];

export const DEFAULT_MAIN_TABLE_SELECT_OPTIONS: MainTableSelectOption[] = [
	{ text: "Pendiente", color: "amber", icon: "clock" },
	{ text: "En progreso", color: "blue", icon: "dot" },
	{ text: "Completado", color: "green", icon: "check" },
];

const VALID_COLORS = new Set<MainTableSelectOptionColor>(
	MAIN_TABLE_SELECT_COLOR_OPTIONS.map((option) => option.value)
);
const VALID_ICONS = new Set<MainTableSelectOptionIcon>(
	MAIN_TABLE_SELECT_ICON_OPTIONS.map((option) => option.value)
);

const normalizeSlug = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_ -]/g, "")
		.replace(/\s+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "");

const toMatchToken = (value: unknown) => normalizeTextForDetection(String(value ?? ""));

export const cloneMainTableSelectOptions = (options: MainTableSelectOption[]) =>
	options.map((option) => ({ ...option }));

export function sanitizeMainTableSelectOptions(raw: unknown): MainTableSelectOption[] {
	if (!Array.isArray(raw)) return [];
	const next: MainTableSelectOption[] = [];
	const usedTexts = new Set<string>();

	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const text =
			typeof row.text === "string"
				? row.text.trim()
				: typeof row.label === "string"
					? row.label.trim()
					: typeof row.title === "string"
						? row.title.trim()
						: "";
		if (!text) continue;
		const key = toMatchToken(text);
		if (!key || usedTexts.has(key)) continue;
		usedTexts.add(key);

		const color =
			typeof row.color === "string" && VALID_COLORS.has(row.color as MainTableSelectOptionColor)
				? (row.color as MainTableSelectOptionColor)
				: undefined;
		const icon =
			typeof row.icon === "string" && VALID_ICONS.has(row.icon as MainTableSelectOptionIcon)
				? (row.icon as MainTableSelectOptionIcon)
				: undefined;

		next.push({ text, color, icon });
	}

	return next;
}

export function getMainTableSelectOptionId(
	option: MainTableSelectOption,
	selectName: string,
	index: number
) {
	const selectSlug = normalizeSlug(selectName) || "select";
	const textSlug = normalizeSlug(option.text) || `option_${index + 1}`;
	return `${selectSlug}__${textSlug}`;
}

export function resolveMainTableSelectOption(
	rawValue: unknown,
	options: MainTableSelectOption[],
	selectName: string
): MainTableSelectOption | null {
	const text = String(rawValue ?? "").trim();
	if (!text) return null;
	const normalized = toMatchToken(text);
	if (!normalized) return null;

	for (let i = 0; i < options.length; i += 1) {
		const option = options[i];
		const optionId = getMainTableSelectOptionId(option, selectName, i);
		if (optionId === text) return option;
		if (toMatchToken(optionId) === normalized) return option;
		if (toMatchToken(option.text) === normalized) return option;
	}

	return null;
}

function levenshteinDistance(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;

	const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	const curr = new Array<number>(b.length + 1);

	for (let i = 1; i <= a.length; i += 1) {
		curr[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		for (let j = 0; j <= b.length; j += 1) {
			prev[j] = curr[j];
		}
	}

	return prev[b.length];
}

function scoreSimilarity(input: string, candidate: string): number {
	if (!input || !candidate) return 0;
	if (input === candidate) return 1;
	if (candidate.startsWith(input) || input.startsWith(candidate)) return 0.92;
	if (candidate.includes(input) || input.includes(candidate)) return 0.82;
	const maxLength = Math.max(input.length, candidate.length);
	if (maxLength === 0) return 0;
	const distance = levenshteinDistance(input, candidate);
	return 1 - distance / maxLength;
}

export function findClosestMainTableSelectOption(
	rawValue: unknown,
	options: MainTableSelectOption[]
): { option: MainTableSelectOption; score: number } | null {
	const text = String(rawValue ?? "").trim();
	if (!text) return null;
	const normalized = toMatchToken(text);
	if (!normalized) return null;

	let best: { option: MainTableSelectOption; score: number } | null = null;
	for (const option of options) {
		const score = scoreSimilarity(normalized, toMatchToken(option.text));
		if (!best || score > best.score) {
			best = { option, score };
		}
	}

	if (!best || best.score < 0.45) return null;
	return best;
}
