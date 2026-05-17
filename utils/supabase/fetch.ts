const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 8000;

function getSupabaseFetchTimeoutMs() {
	const raw = process.env.SUPABASE_FETCH_TIMEOUT_MS;
	const parsed = raw ? Number(raw) : NaN;
	return Number.isFinite(parsed) && parsed > 0
		? parsed
		: DEFAULT_SUPABASE_FETCH_TIMEOUT_MS;
}

export function supabaseServerFetch(
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
) {
	const controller = new AbortController();
	const timeout = setTimeout(() => {
		controller.abort();
	}, getSupabaseFetchTimeoutMs());
	const upstreamSignal = init?.signal;

	if (upstreamSignal) {
		if (upstreamSignal.aborted) {
			controller.abort();
		} else {
			upstreamSignal.addEventListener("abort", () => controller.abort(), {
				once: true,
			});
		}
	}

	return fetch(input, {
		...init,
		signal: controller.signal,
	}).finally(() => {
		clearTimeout(timeout);
	});
}
