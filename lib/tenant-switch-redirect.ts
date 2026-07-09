const UNSAFE_PATH_CHARACTERS = /[\\\u0000-\u001f\u007f]/;
const ENCODED_BACKSLASH = /%5c/i;

export function resolveTenantSwitchRedirect(
	requestUrl: string,
	nextPath: string | null,
	fallbackPath = "/excel",
) {
	const fallbackUrl = new URL(fallbackPath, requestUrl);

	if (
		!nextPath ||
		!nextPath.startsWith("/") ||
		nextPath.startsWith("//") ||
		UNSAFE_PATH_CHARACTERS.test(nextPath) ||
		ENCODED_BACKSLASH.test(nextPath)
	) {
		return fallbackUrl;
	}

	try {
		const redirectUrl = new URL(nextPath, requestUrl);
		return redirectUrl.origin === fallbackUrl.origin ? redirectUrl : fallbackUrl;
	} catch {
		return fallbackUrl;
	}
}
