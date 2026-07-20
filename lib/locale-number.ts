export function parseArgentineNumber(value: string): number | null {
	const compact = value.trim().replace(/\s/g, "");
	if (!compact) return 0;
	if (!/^\d+(?:[.,]\d+)*$/.test(compact)) return null;

	const commaIndex = compact.lastIndexOf(",");
	const dotIndex = compact.lastIndexOf(".");
	let normalized = compact;

	if (commaIndex >= 0 && dotIndex >= 0) {
		if (commaIndex > dotIndex) {
			normalized = compact.replace(/\./g, "").replace(",", ".");
		} else {
			normalized = compact.replace(/,/g, "");
		}
	} else if (commaIndex >= 0) {
		normalized = compact.replace(",", ".");
	} else if (dotIndex >= 0) {
		const parts = compact.split(".");
		const looksGrouped = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
		if (looksGrouped) normalized = parts.join("");
	}

	const parsed = Number(normalized);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
