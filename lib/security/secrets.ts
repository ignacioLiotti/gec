type VersionedSecretResult = {
	value: string | undefined;
	version?: string;
};

export function getVersionedSecret(baseKey: string): VersionedSecretResult {
	const versionEnvKey = `${baseKey}_VERSION`;
	const activeVersion = process.env[versionEnvKey];

	if (activeVersion) {
		const candidate = process.env[`${baseKey}_V${activeVersion}`];
		return {
			value: candidate,
			version: activeVersion,
		};
	}

	return {
		value: process.env[baseKey],
		version: undefined,
	};
}

export function requireVersionedSecret(baseKey: string, label: string): string {
	const { value, version } = getVersionedSecret(baseKey);
	if (!value) {
		throw new Error(
			`Missing ${label}. Set ${baseKey}${
				version ? `_V${version}` : ""
			} or configure ${baseKey}_VERSION`
		);
	}
	return value;
}
