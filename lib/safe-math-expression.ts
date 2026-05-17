type Token =
	| { type: "number"; value: number }
	| { type: "identifier"; value: string }
	| { type: "operator"; value: "+" | "-" | "*" | "/" | "%" }
	| { type: "paren"; value: "(" | ")" };

type ParseResult =
	| { ok: true; value: number }
	| { ok: false; errorMessage: string };

type TokenizeResult =
	| { ok: true; tokens: Token[] }
	| { ok: false; errorMessage: string };

function tokenize(expression: string): TokenizeResult {
	const tokens: Token[] = [];
	let index = 0;

	while (index < expression.length) {
		const char = expression[index];
		if (/\s/.test(char)) {
			index += 1;
			continue;
		}

		if (/[0-9.]/.test(char)) {
			let raw = char;
			index += 1;
			while (index < expression.length && /[0-9.,]/.test(expression[index])) {
				raw += expression[index];
				index += 1;
			}
			const normalized = raw.replace(",", ".");
			if ((normalized.match(/\./g) ?? []).length > 1) {
				return { ok: false, errorMessage: "Numero invalido en la expresion." };
			}
			const value = Number(normalized);
			if (!Number.isFinite(value)) {
				return { ok: false, errorMessage: "Numero invalido en la expresion." };
			}
			tokens.push({ type: "number", value });
			continue;
		}

		if (/[a-zA-Z_]/.test(char)) {
			let value = char;
			index += 1;
			while (index < expression.length && /[a-zA-Z0-9_]/.test(expression[index])) {
				value += expression[index];
				index += 1;
			}
			tokens.push({ type: "identifier", value });
			continue;
		}

		if (char === "(" || char === ")") {
			tokens.push({ type: "paren", value: char });
			index += 1;
			continue;
		}

		if (char === "+" || char === "-" || char === "*" || char === "/" || char === "%") {
			tokens.push({ type: "operator", value: char });
			index += 1;
			continue;
		}

		return { ok: false, errorMessage: "La expresion contiene caracteres no permitidos." };
	}

	return { ok: true, tokens };
}

class MathExpressionParser {
	private index = 0;

	constructor(
		private readonly tokens: Token[],
		private readonly variables: Record<string, number>
	) {}

	parse(): ParseResult {
		const value = this.parseExpression();
		if (!value.ok) return value;
		if (this.peek()) {
			return { ok: false, errorMessage: "La expresion tiene tokens inesperados." };
		}
		return Number.isFinite(value.value)
			? value
			: { ok: false, errorMessage: "La expresion no devolvio un numero valido." };
	}

	private parseExpression(): ParseResult {
		let left = this.parseTerm();
		while (left.ok && this.matchOperator("+", "-")) {
			const operator = this.previous().value;
			const right = this.parseTerm();
			if (!right.ok) return right;
			left = {
				ok: true,
				value: operator === "+" ? left.value + right.value : left.value - right.value,
			};
		}
		return left;
	}

	private parseTerm(): ParseResult {
		let left = this.parseUnary();
		while (left.ok && this.matchOperator("*", "/", "%")) {
			const operator = this.previous().value;
			const right = this.parseUnary();
			if (!right.ok) return right;
			const value =
				operator === "*"
					? left.value * right.value
					: operator === "/"
						? left.value / right.value
						: left.value % right.value;
			left = Number.isFinite(value)
				? { ok: true, value }
				: { ok: false, errorMessage: "La expresion no devolvio un numero valido." };
		}
		return left;
	}

	private parseUnary(): ParseResult {
		if (this.matchOperator("+")) return this.parseUnary();
		if (this.matchOperator("-")) {
			const value = this.parseUnary();
			return value.ok ? { ok: true, value: -value.value } : value;
		}
		return this.parsePrimary();
	}

	private parsePrimary(): ParseResult {
		const token = this.advance();
		if (!token) {
			return { ok: false, errorMessage: "La expresion esta incompleta." };
		}
		if (token.type === "number") return { ok: true, value: token.value };
		if (token.type === "identifier") {
			const value = this.variables[token.value];
			return Number.isFinite(value)
				? { ok: true, value }
				: { ok: false, errorMessage: `Variable desconocida: ${token.value}.` };
		}
		if (token.type === "paren" && token.value === "(") {
			const value = this.parseExpression();
			if (!value.ok) return value;
			if (!this.matchParen(")")) {
				return { ok: false, errorMessage: "Falta cerrar un parentesis." };
			}
			return value;
		}
		return { ok: false, errorMessage: "La expresion esta mal formada." };
	}

	private matchOperator(...operators: Array<"+" | "-" | "*" | "/" | "%">) {
		const token = this.peek();
		if (token?.type !== "operator" || !operators.includes(token.value)) {
			return false;
		}
		this.index += 1;
		return true;
	}

	private matchParen(paren: "(" | ")") {
		const token = this.peek();
		if (token?.type !== "paren" || token.value !== paren) return false;
		this.index += 1;
		return true;
	}

	private advance() {
		const token = this.peek();
		if (token) this.index += 1;
		return token;
	}

	private previous() {
		return this.tokens[this.index - 1] as Token & { type: "operator" };
	}

	private peek() {
		return this.tokens[this.index];
	}
}

export function evaluateMathExpression(
	expression: string,
	variables: Record<string, number> = {}
): { value: number | null; errorMessage: string | null } {
	const trimmed = expression.trim();
	if (!trimmed) {
		return { value: null, errorMessage: "La expresion esta vacia." };
	}

	const tokenized = tokenize(trimmed);
	if (!tokenized.ok) {
		return { value: null, errorMessage: tokenized.errorMessage };
	}

	const parsed = new MathExpressionParser(tokenized.tokens, variables).parse();
	return parsed.ok
		? { value: parsed.value, errorMessage: null }
		: { value: null, errorMessage: parsed.errorMessage };
}
