export function readPersistedArray(key: string): string[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(key);
		const parsed = raw ? (JSON.parse(raw) as string[]) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function writePersistedArray(key: string, value: string[]) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore
	}
}

export function readPersistedNumber(key: string): number | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return null;
		const parsed = Number(JSON.parse(raw));
		return Number.isFinite(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function writePersistedNumber(key: string, value: number) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore
	}
}










