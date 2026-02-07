"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { FileSystemItem, OcrFolderLink } from "../types";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
	getCachedFileTree,
	setCachedFileTree,
	getCachedOcrLinks,
	setCachedOcrLinks,
	getCachedApsModels,
	setCachedApsModels,
} from "../cache";

// Global state that persists across component mounts
type DocumentsStoreState = {
	fileTree: FileSystemItem | null;
	ocrFolderLinks: OcrFolderLink[];
	selectedFolder: FileSystemItem | null;
	selectedDocument: FileSystemItem | null;
	sheetDocument: FileSystemItem | null;
	expandedFolderIds: Set<string>;
	isLoading: boolean;
	lastFetchedAt: number | null;
	obraId: string | null;
};

const initialState: DocumentsStoreState = {
	fileTree: null,
	ocrFolderLinks: [],
	selectedFolder: null,
	selectedDocument: null,
	sheetDocument: null,
	expandedFolderIds: new Set(["root"]),
	isLoading: false,
	lastFetchedAt: null,
	obraId: null,
};

// Global store (module-level singleton)
let globalState = { ...initialState };
const listeners = new Set<() => void>();

function emitChange() {
	listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot() {
	return globalState;
}

// Actions
export function setDocumentsState(patch: Partial<DocumentsStoreState>) {
	globalState = { ...globalState, ...patch };
	emitChange();
}

export function resetDocumentsStore(obraId: string) {
	// Only reset if switching to a different obra
	if (globalState.obraId !== obraId) {
		globalState = { ...initialState, obraId };
		emitChange();
	}
}

export function setFileTree(tree: FileSystemItem | null) {
	globalState = { ...globalState, fileTree: tree };
	emitChange();
}

export function setOcrFolderLinks(links: OcrFolderLink[]) {
	globalState = { ...globalState, ocrFolderLinks: links };
	emitChange();
}

export function setSelectedFolder(folder: FileSystemItem | null) {
	globalState = { ...globalState, selectedFolder: folder };
	emitChange();
}

export function setSelectedDocument(doc: FileSystemItem | null) {
	globalState = { ...globalState, selectedDocument: doc };
	emitChange();
}

export function setSheetDocument(doc: FileSystemItem | null) {
	globalState = { ...globalState, sheetDocument: doc };
	emitChange();
}

export function setExpandedFolderIds(ids: Set<string>) {
	globalState = { ...globalState, expandedFolderIds: ids };
	emitChange();
}

export function setDocumentsLoading(loading: boolean) {
	globalState = { ...globalState, isLoading: loading };
	emitChange();
}

export function setLastFetchedAt(timestamp: number | null) {
	globalState = { ...globalState, lastFetchedAt: timestamp };
	emitChange();
}

export function markDocumentsFetched() {
	globalState = { ...globalState, lastFetchedAt: Date.now(), isLoading: false };
	emitChange();
}

// Check if we need to fetch (data is stale or missing)
export function needsRefetch(obraId: string, maxAge = 5 * 60 * 1000): boolean {
	// Different obra - needs fetch
	if (globalState.obraId !== obraId) return true;
	// No data - needs fetch
	if (!globalState.fileTree) return true;
	// Data is stale
	if (!globalState.lastFetchedAt) return true;
	if (Date.now() - globalState.lastFetchedAt > maxAge) return true;
	return false;
}

// Get current state without subscribing (for one-off reads)
export function getDocumentsState() {
	return globalState;
}

// Hook to subscribe to store changes
export function useDocumentsStore() {
	const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	const actions = useMemo(
		() => ({
			setFileTree,
			setOcrFolderLinks,
			setSelectedFolder,
			setSelectedDocument,
			setSheetDocument,
			setExpandedFolderIds,
			setDocumentsLoading,
			setLastFetchedAt,
			markDocumentsFetched,
			resetDocumentsStore,
			setDocumentsState,
		}),
		[]
	);

	return { state, actions };
}

// Prefetch function - call this early to start loading documents in background
let prefetchPromise: Promise<void> | null = null;

export async function prefetchDocuments(obraId: string): Promise<void> {
	// Skip if we already have fresh data
	if (!needsRefetch(obraId)) {
		return;
	}

	// Dedupe concurrent prefetch calls
	if (prefetchPromise) {
		return prefetchPromise;
	}

	prefetchPromise = (async () => {
		try {
			// Update state to indicate we're loading for this obra
			globalState = { ...globalState, obraId, isLoading: true };
			emitChange();

			const supabase = createSupabaseBrowserClient();

			// Fetch APS models (for 3D viewer)
			let apsModels = getCachedApsModels(obraId);
			if (!apsModels) {
				const apsRes = await fetch(`/api/aps/models?obraId=${obraId}`);
				if (apsRes.ok) {
					const apsData = await apsRes.json();
					apsModels = apsData.data || [];
					if (apsModels && apsModels.length > 0) {
						setCachedApsModels(obraId, apsModels);
					}
				} else {
					apsModels = [];
				}
			}

			// Fetch enriched file tree (includes OCR metadata)
			let cachedTree = getCachedFileTree(obraId);
			let cachedOcrLinks = getCachedOcrLinks(obraId);
			if (!cachedTree || !cachedOcrLinks) {
				const res = await fetch(`/api/obras/${obraId}/documents-tree?limit=500`);
				if (res.ok) {
					const data = await res.json().catch(() => ({}));
					const tree = data?.tree ?? null;
					const links = Array.isArray(data?.links) ? data.links : [];
					if (tree) {
						cachedTree = tree as FileSystemItem;
						setCachedFileTree(obraId, cachedTree);
					}
					cachedOcrLinks = links;
					setCachedOcrLinks(obraId, links);
				}
			}

			if (cachedTree) {
				setFileTree(cachedTree);
				setSelectedFolder(cachedTree);
				setExpandedFolderIds(new Set(["root"]));
			}
			if (cachedOcrLinks) {
				setOcrFolderLinks(cachedOcrLinks);
			}

			markDocumentsFetched();
		} catch (error) {
			console.error("[prefetchDocuments] Error:", error);
			globalState = { ...globalState, isLoading: false };
			emitChange();
		} finally {
			prefetchPromise = null;
		}
	})();

	return prefetchPromise;
}
