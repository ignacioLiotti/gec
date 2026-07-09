export const toText = (value: unknown) => (value ?? "").toString().trim();

export const toNumber = (value: unknown) => {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const cleaned = value.replace(",", ".").replace(/[^0-9.-]/g, "");
		const parsed = Number(cleaned);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
};

export const clampPercentage = (value: unknown) =>
	Math.max(0, Math.min(100, toNumber(value)));
