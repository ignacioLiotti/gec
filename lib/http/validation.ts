import type { ZodSchema } from "zod";
import { z } from "zod";

export class ApiValidationError extends Error {
	status: number;
	issues: string[];
	fieldErrors?: Record<string, string[] | undefined>;

	constructor(
		message: string,
		issues: string[] = [],
		status = 400,
		fieldErrors?: Record<string, string[] | undefined>
	) {
		super(message);
		this.name = "ApiValidationError";
		this.status = status;
		this.issues = issues;
		this.fieldErrors = fieldErrors;
	}
}

export function validateWithSchema<T>(
	schema: ZodSchema<T>,
	value: unknown,
	context: string
): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success) {
		const flattened = parsed.error.flatten();
		const issueMessages = parsed.error.issues.map((issue) => {
			const path = issue.path.join(".");
			return path ? `${path}: ${issue.message}` : issue.message;
		});
		throw new ApiValidationError(
			`Invalid ${context}`,
			issueMessages,
			400,
			flattened.fieldErrors
		);
	}
	return parsed.data;
}

export async function validateJsonBody<T>(
	request: Request,
	schema: ZodSchema<T>
): Promise<T> {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		throw new ApiValidationError("Cuerpo JSON inválido", ["invalid_json"]);
	}
	return validateWithSchema(schema, payload, "body");
}

export function validateSearchParams<T>(
	params: URLSearchParams,
	schema: ZodSchema<T>
): T {
	const entries: Record<string, string | string[] | undefined> = {};
	for (const key of params.keys()) {
		const allValues = params.getAll(key);
		entries[key] = allValues.length > 1 ? allValues : params.get(key) ?? undefined;
	}
	return validateWithSchema(schema, entries, "query");
}

export function validateFormData<T>(
	formData: FormData,
	schema: ZodSchema<T>
): T {
	const entries: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
	for (const key of formData.keys()) {
		const values = formData.getAll(key);
		entries[key] = values.length > 1 ? values : formData.get(key) ?? "";
	}
	return validateWithSchema(schema, entries, "form");
}

export const PaginationQuerySchema = z.object({
	page: z.coerce.number().int().gte(1).optional(),
	limit: z.coerce.number().int().gte(1).lte(500).optional(),
});
