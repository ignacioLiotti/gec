export const AI_MODEL_COST_PER_1K_TOKENS: Record<string, number> = {
	"gpt-4o-mini": 0.00015, // USD per 1K tokens (approx from OpenAI pricing)
};

export function estimateUsdForTokens(model: string | null, tokens: number): number | null {
	if (!model) return null;
	const rate = AI_MODEL_COST_PER_1K_TOKENS[model];
	if (!rate) return null;
	const cost = (tokens / 1000) * rate;
	return Number.isFinite(cost) ? cost : null;
}
