"use client";

import type { FileSystemItem } from "./types";

type CachedUrl = { url: string; expiresAt: number };
const signedUrlCache = new Map<string, CachedUrl>();
const URL_CACHE_DURATION = 55 * 60 * 1000; // 55 minutes

type CachedFileTree = { tree: FileSystemItem; timestamp: number };
const fileTreeCache = new Map<string, CachedFileTree>();
const FILE_TREE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

type CachedBlob = { blobUrl: string; expiresAt: number };
const blobCache = new Map<string, CachedBlob>();
const BLOB_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

type CachedApsModels = { models: Array<{ file_path: string; aps_urn: string }>; timestamp: number };
const apsModelsCache = new Map<string, CachedApsModels>();
const APS_CACHE_DURATION = 30 * 60 * 1000;

type CachedOcrLinks = { links: any[]; timestamp: number };
const ocrLinksCache = new Map<string, CachedOcrLinks>();
const OCR_LINKS_CACHE_DURATION = 10 * 60 * 1000;

export function getCachedFileTree(obraId: string): FileSystemItem | null {
	const cached = fileTreeCache.get(obraId);
	if (cached && Date.now() - cached.timestamp < FILE_TREE_CACHE_DURATION) {
		return cached.tree;
	}
	fileTreeCache.delete(obraId);
	return null;
}

export function setCachedFileTree(obraId: string, tree: FileSystemItem): void {
	fileTreeCache.set(obraId, { tree, timestamp: Date.now() });
}

export function invalidateFileTreeCache(obraId: string): void {
	fileTreeCache.delete(obraId);
}

export function getCachedSignedUrl(storagePath: string): string | null {
	const cached = signedUrlCache.get(storagePath);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.url;
	}
	signedUrlCache.delete(storagePath);
	return null;
}

export function setCachedSignedUrl(storagePath: string, url: string): void {
	signedUrlCache.set(storagePath, { url, expiresAt: Date.now() + URL_CACHE_DURATION });
}

export function getCachedBlobUrl(storagePath: string): string | null {
	const cached = blobCache.get(storagePath);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.blobUrl;
	}
	if (cached) {
		URL.revokeObjectURL(cached.blobUrl);
		blobCache.delete(storagePath);
	}
	return null;
}

export function setCachedBlobUrl(storagePath: string, blobUrl: string): void {
	const existing = blobCache.get(storagePath);
	if (existing) {
		URL.revokeObjectURL(existing.blobUrl);
	}
	blobCache.set(storagePath, { blobUrl, expiresAt: Date.now() + BLOB_CACHE_DURATION });
}

export function clearCachesForObra(obraId: string): void {
	fileTreeCache.delete(obraId);
	apsModelsCache.delete(obraId);
	ocrLinksCache.delete(obraId);
}

export function getCachedApsModels(obraId: string) {
	const cached = apsModelsCache.get(obraId);
	if (cached && Date.now() - cached.timestamp < APS_CACHE_DURATION) {
		return cached.models;
	}
	apsModelsCache.delete(obraId);
	return null;
}

export function setCachedApsModels(obraId: string, models: Array<{ file_path: string; aps_urn: string }>) {
	apsModelsCache.set(obraId, { models, timestamp: Date.now() });
}

export function getCachedOcrLinks(obraId: string) {
	const cached = ocrLinksCache.get(obraId);
	if (cached && Date.now() - cached.timestamp < OCR_LINKS_CACHE_DURATION) {
		return cached.links;
	}
	ocrLinksCache.delete(obraId);
	return null;
}

export function setCachedOcrLinks(obraId: string, links: any[]) {
	ocrLinksCache.set(obraId, { links, timestamp: Date.now() });
}

export async function preloadAndCacheFile(signedUrl: string, storagePath: string): Promise<string> {
	const cached = getCachedBlobUrl(storagePath);
	if (cached) return cached;
	try {
		const response = await fetch(signedUrl);
		if (!response.ok) throw new Error("Failed to fetch");
		const blob = await response.blob();
		const blobUrl = URL.createObjectURL(blob);
		setCachedBlobUrl(storagePath, blobUrl);
		return blobUrl;
	} catch {
		return signedUrl;
	}
}
