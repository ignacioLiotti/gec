import { toNumericValue } from "@/lib/tablas";

/**
 * Safe formula language for document templates.
 *
 *   [cantidad] * [precio_unitario]
 *   SUMA(items.precio_total)
 *   REDONDEAR([subtotal] * 0.21; 2)
 *   SI([total] > 1000000; [total] * 0.05; 0)
 *
 * Field references use brackets. Table columns are written `tabla.columna`
 * and are only valid inside aggregate functions. Arguments are separated by
 * `;` (a `,` is accepted when it is not a decimal separator).
 */

type Token =
	| { type: "number"; value: number }
	| { type: "ref"; value: string }
	| { type: "path"; table: string; column: string }
	| { type: "name"; value: string }
	| { type: "op"; value: string }
	| { type: "paren"; value: "(" | ")" }
	| { type: "sep" };

type Node =
	| { kind: "number"; value: number }
	| { kind: "ref"; key: string }
	| { kind: "path"; table: string; column: string }
	| { kind: "unary"; operand: Node }
	| { kind: "binary"; op: string; left: Node; right: Node }
	| { kind: "call"; name: string; args: Node[] };

const FUNCTION_ALIASES: Record<string, string> = {
	SUMA: "SUM",
	SUM: "SUM",
	PROMEDIO: "AVG",
	AVG: "AVG",
	MIN: "MIN",
	MAX: "MAX",
	CONTAR: "COUNT",
	COUNT: "COUNT",
	REDONDEAR: "ROUND",
	ROUND: "ROUND",
	SI: "IF",
	IF: "IF",
	ABS: "ABS",
};

const AGGREGATES = new Set(["SUM", "AVG", "MIN", "MAX", "COUNT"]);

export const DOCUMENT_FORMULA_FUNCTIONS = [
	{ name: "SUMA", usage: "SUMA(tabla.columna)", description: "Suma una columna de una tabla del documento." },
	{ name: "PROMEDIO", usage: "PROMEDIO(tabla.columna)", description: "Promedio de una columna." },
	{ name: "MIN", usage: "MIN(tabla.columna) o MIN(a; b)", description: "Valor mínimo." },
	{ name: "MAX", usage: "MAX(tabla.columna) o MAX(a; b)", description: "Valor máximo." },
	{ name: "CONTAR", usage: "CONTAR(tabla.columna)", description: "Cantidad de filas con valor en la columna." },
	{ name: "REDONDEAR", usage: "REDONDEAR(valor; decimales)", description: "Redondea; decimales es opcional (0)." },
	{ name: "SI", usage: "SI(condición; si_verdadero; si_falso)", description: "Condicional. Comparadores: > < >= <= = <>." },
	{ name: "ABS", usage: "ABS(valor)", description: "Valor absoluto." },
] as const;

export type DocumentFormulaAnalysis = {
	ok: boolean;
	error: string | null;
	references: string[];
	columns: Array<{ table: string; column: string }>;
};

export type DocumentFormulaResult = {
	value: number | null;
	error: string | null;
	missing: string[];
};

class FormulaError extends Error {}

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let index = 0;
	while (index < source.length) {
		const char = source[index];
		if (/\s/.test(char)) {
			index += 1;
			continue;
		}
		if (/[0-9]/.test(char) || (char === "." && /[0-9]/.test(source[index + 1] ?? ""))) {
			const match = /^[0-9]*(?:[.,][0-9]+)?/.exec(source.slice(index));
			const raw = match?.[0] ?? char;
			tokens.push({ type: "number", value: Number(raw.replace(",", ".")) });
			index += raw.length;
			continue;
		}
		if (char === "[") {
			const end = source.indexOf("]", index);
			if (end < 0) throw new FormulaError("Falta cerrar un corchete.");
			const key = source.slice(index + 1, end).trim();
			if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(key)) {
				throw new FormulaError(`Referencia inválida: [${key}].`);
			}
			if (key.includes(".")) {
				const [table, column] = key.split(".");
				tokens.push({ type: "path", table, column });
			} else {
				tokens.push({ type: "ref", value: key });
			}
			index = end + 1;
			continue;
		}
		if (/[a-zA-Z_]/.test(char)) {
			const match = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?/.exec(source.slice(index));
			const raw = match?.[0] ?? char;
			if (raw.includes(".")) {
				const [table, column] = raw.split(".");
				tokens.push({ type: "path", table, column });
			} else {
				tokens.push({ type: "name", value: raw });
			}
			index += raw.length;
			continue;
		}
		const two = source.slice(index, index + 2);
		if (two === ">=" || two === "<=" || two === "<>" || two === "!=" || two === "==") {
			tokens.push({ type: "op", value: two === "!=" ? "<>" : two === "==" ? "=" : two });
			index += 2;
			continue;
		}
		if ("+-*/><=".includes(char)) {
			tokens.push({ type: "op", value: char });
			index += 1;
			continue;
		}
		if (char === "(" || char === ")") {
			tokens.push({ type: "paren", value: char });
			index += 1;
			continue;
		}
		if (char === ";" || char === ",") {
			tokens.push({ type: "sep" });
			index += 1;
			continue;
		}
		throw new FormulaError(`Carácter no permitido: "${char}".`);
	}
	return tokens;
}

class Parser {
	private index = 0;
	constructor(private readonly tokens: Token[]) {}

	parse(): Node {
		const node = this.comparison();
		if (this.index < this.tokens.length) throw new FormulaError("Sobra texto al final de la fórmula.");
		return node;
	}

	private peek() {
		return this.tokens[this.index];
	}

	private isOp(...values: string[]) {
		const token = this.peek();
		return token?.type === "op" && values.includes(token.value);
	}

	private comparison(): Node {
		let left = this.additive();
		while (this.isOp(">", "<", ">=", "<=", "=", "<>")) {
			const op = (this.tokens[this.index++] as { value: string }).value;
			left = { kind: "binary", op, left, right: this.additive() };
		}
		return left;
	}

	private additive(): Node {
		let left = this.term();
		while (this.isOp("+", "-")) {
			const op = (this.tokens[this.index++] as { value: string }).value;
			left = { kind: "binary", op, left, right: this.term() };
		}
		return left;
	}

	private term(): Node {
		let left = this.unary();
		while (this.isOp("*", "/")) {
			const op = (this.tokens[this.index++] as { value: string }).value;
			left = { kind: "binary", op, left, right: this.unary() };
		}
		return left;
	}

	private unary(): Node {
		if (this.isOp("-")) {
			this.index += 1;
			return { kind: "unary", operand: this.unary() };
		}
		if (this.isOp("+")) {
			this.index += 1;
			return this.unary();
		}
		return this.primary();
	}

	private primary(): Node {
		const token = this.peek();
		if (!token) throw new FormulaError("La fórmula termina antes de tiempo.");
		this.index += 1;
		if (token.type === "number") return { kind: "number", value: token.value };
		if (token.type === "ref") return { kind: "ref", key: token.value };
		if (token.type === "path") return { kind: "path", table: token.table, column: token.column };
		if (token.type === "paren" && token.value === "(") {
			const inner = this.comparison();
			this.expectClose();
			return inner;
		}
		if (token.type === "name") {
			const name = FUNCTION_ALIASES[token.value.toUpperCase()];
			if (!name) {
				throw new FormulaError(`"${token.value}" no es una función. Para un campo usá [${token.value}].`);
			}
			const open = this.peek();
			if (open?.type !== "paren" || open.value !== "(") throw new FormulaError(`Falta "(" después de ${token.value}.`);
			this.index += 1;
			const args: Node[] = [];
			if (!(this.peek()?.type === "paren" && (this.peek() as { value: string }).value === ")")) {
				args.push(this.comparison());
				while (this.peek()?.type === "sep") {
					this.index += 1;
					args.push(this.comparison());
				}
			}
			this.expectClose();
			return { kind: "call", name, args };
		}
		throw new FormulaError("Fórmula incompleta o con un operador de más.");
	}

	private expectClose() {
		const token = this.peek();
		if (token?.type !== "paren" || token.value !== ")") throw new FormulaError("Falta cerrar un paréntesis.");
		this.index += 1;
	}
}

function parseFormula(formula: string): Node {
	return new Parser(tokenize(formula)).parse();
}

function validateNode(node: Node, insideAggregate: boolean) {
	if (node.kind === "path" && !insideAggregate) {
		throw new FormulaError(`${node.table}.${node.column} es una columna: usala dentro de SUMA, PROMEDIO, MIN, MAX o CONTAR.`);
	}
	if (node.kind === "unary") validateNode(node.operand, false);
	if (node.kind === "binary") {
		validateNode(node.left, false);
		validateNode(node.right, false);
	}
	if (node.kind === "call") {
		if (node.name === "IF" && node.args.length !== 3) throw new FormulaError("SI necesita 3 argumentos: condición; si verdadero; si falso.");
		if (node.name === "ROUND" && (node.args.length < 1 || node.args.length > 2)) throw new FormulaError("REDONDEAR necesita 1 o 2 argumentos.");
		if (node.name === "ABS" && node.args.length !== 1) throw new FormulaError("ABS necesita 1 argumento.");
		if (AGGREGATES.has(node.name) && node.args.length === 0) throw new FormulaError("La función necesita al menos un argumento.");
		const aggregateOverColumn = AGGREGATES.has(node.name) && node.args.length === 1 && node.args[0].kind === "path";
		for (const arg of node.args) validateNode(arg, aggregateOverColumn);
	}
}

function collect(node: Node, references: Set<string>, columns: Map<string, { table: string; column: string }>) {
	if (node.kind === "ref") references.add(node.key);
	if (node.kind === "path") columns.set(`${node.table}.${node.column}`, { table: node.table, column: node.column });
	if (node.kind === "unary") collect(node.operand, references, columns);
	if (node.kind === "binary") {
		collect(node.left, references, columns);
		collect(node.right, references, columns);
	}
	if (node.kind === "call") node.args.forEach((arg) => collect(arg, references, columns));
}

export function analyzeDocumentFormula(formula: string): DocumentFormulaAnalysis {
	try {
		const node = parseFormula(formula);
		validateNode(node, false);
		const references = new Set<string>();
		const columns = new Map<string, { table: string; column: string }>();
		collect(node, references, columns);
		return { ok: true, error: null, references: [...references], columns: [...columns.values()] };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof FormulaError ? error.message : "La fórmula no es válida.",
			references: [],
			columns: [],
		};
	}
}

function hasValue(value: unknown) {
	return value != null && !(typeof value === "string" && value.trim() === "");
}

function columnValues(scope: Record<string, unknown>, table: string, column: string) {
	const rows = scope[table];
	if (!Array.isArray(rows)) return [];
	return rows
		.map((row) => (row && typeof row === "object" ? toNumericValue((row as Record<string, unknown>)[column]) : null))
		.filter((value): value is number => value != null);
}

function evaluateNode(node: Node, scope: Record<string, unknown>, missing: Set<string>): number {
	switch (node.kind) {
		case "number":
			return node.value;
		case "ref": {
			const raw = scope[node.key];
			if (!hasValue(raw)) {
				missing.add(node.key);
				return 0;
			}
			const numeric = toNumericValue(raw);
			if (numeric == null) {
				missing.add(node.key);
				return 0;
			}
			return numeric;
		}
		case "path":
			throw new FormulaError("Columna fuera de una función.");
		case "unary":
			return -evaluateNode(node.operand, scope, missing);
		case "binary": {
			const left = evaluateNode(node.left, scope, missing);
			const right = evaluateNode(node.right, scope, missing);
			switch (node.op) {
				case "+": return left + right;
				case "-": return left - right;
				case "*": return left * right;
				case "/":
					if (right === 0) throw new FormulaError("División por cero.");
					return left / right;
				case ">": return left > right ? 1 : 0;
				case "<": return left < right ? 1 : 0;
				case ">=": return left >= right ? 1 : 0;
				case "<=": return left <= right ? 1 : 0;
				case "=": return left === right ? 1 : 0;
				case "<>": return left !== right ? 1 : 0;
				default: throw new FormulaError(`Operador desconocido: ${node.op}`);
			}
		}
		case "call": {
			if (node.name === "IF") {
				const condition = evaluateNode(node.args[0], scope, missing);
				return condition !== 0
					? evaluateNode(node.args[1], scope, missing)
					: evaluateNode(node.args[2], scope, missing);
			}
			if (node.name === "ROUND") {
				const value = evaluateNode(node.args[0], scope, missing);
				const digits = node.args[1] ? Math.max(0, Math.min(10, Math.trunc(evaluateNode(node.args[1], scope, missing)))) : 0;
				const factor = 10 ** digits;
				return Math.round((value + Number.EPSILON) * factor) / factor;
			}
			if (node.name === "ABS") return Math.abs(evaluateNode(node.args[0], scope, missing));
			const values =
				node.args.length === 1 && node.args[0].kind === "path"
					? columnValues(scope, node.args[0].table, node.args[0].column)
					: node.args.map((arg) => evaluateNode(arg, scope, missing));
			switch (node.name) {
				case "SUM": return values.reduce((sum, value) => sum + value, 0);
				case "AVG": return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
				case "MIN": return values.length ? Math.min(...values) : 0;
				case "MAX": return values.length ? Math.max(...values) : 0;
				case "COUNT": return values.length;
				default: throw new FormulaError(`Función desconocida: ${node.name}`);
			}
		}
	}
}

/**
 * Evaluates a formula against a scope. Row formulas receive the row merged
 * over the document; document formulas receive the document (tables are
 * arrays of rows). A missing field reference yields `value: null` so the
 * caller can leave the target empty until the inputs exist.
 */
export function evaluateDocumentFormula(
	formula: string | null | undefined,
	scope: Record<string, unknown>,
): DocumentFormulaResult {
	if (!formula || !formula.trim()) return { value: null, error: "La fórmula está vacía.", missing: [] };
	try {
		const node = parseFormula(formula);
		validateNode(node, false);
		const missing = new Set<string>();
		const value = evaluateNode(node, scope, missing);
		if (missing.size > 0) return { value: null, error: null, missing: [...missing] };
		if (!Number.isFinite(value)) return { value: null, error: "El resultado no es un número.", missing: [] };
		return { value: Math.round((value + Number.EPSILON) * 1e6) / 1e6, error: null, missing: [] };
	} catch (error) {
		return {
			value: null,
			error: error instanceof FormulaError ? error.message : "La fórmula no es válida.",
			missing: [],
		};
	}
}
