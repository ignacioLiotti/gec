export interface StorageAdapter {
	saveGeneratedDoc: (params: {
		obraId: string;
		path: string;
		bytes: Uint8Array;
		contentType: string;
	}) => Promise<{ storagePath: string }>;
}

export const noopStorageAdapter: StorageAdapter = {
	async saveGeneratedDoc() {
		throw new Error("storage_adapter_not_configured");
	},
};
