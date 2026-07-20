"use client";

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	useSyncExternalStore,
	type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type SearchHighlightSegment = {
	text: string;
	highlighted: boolean;
};

type NormalizedSearchIndex = {
	text: string;
	sourceStarts: number[];
	sourceEnds: number[];
};

function buildNormalizedSearchIndex(value: string, compact: boolean): NormalizedSearchIndex {
	let text = "";
	const sourceStarts: number[] = [];
	const sourceEnds: number[] = [];
	let sourceOffset = 0;

	for (const sourceCharacter of value) {
		const normalizedCharacters = sourceCharacter
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "")
			.toLowerCase();

		for (const normalizedCharacter of normalizedCharacters) {
			if (compact && !/[a-z0-9]/.test(normalizedCharacter)) continue;
			text += normalizedCharacter;
			sourceStarts.push(sourceOffset);
			sourceEnds.push(sourceOffset + sourceCharacter.length);
		}

		sourceOffset += sourceCharacter.length;
	}

	return { text, sourceStarts, sourceEnds };
}

function findNormalizedMatches(value: string, query: string, compact: boolean) {
	const valueIndex = buildNormalizedSearchIndex(value, compact);
	const normalizedQuery = buildNormalizedSearchIndex(query, compact).text.trim();
	if (!normalizedQuery) return [];

	const matches: Array<{ start: number; end: number }> = [];
	let searchFrom = 0;
	while (searchFrom < valueIndex.text.length) {
		const matchStart = valueIndex.text.indexOf(normalizedQuery, searchFrom);
		if (matchStart === -1) break;
		const matchEnd = matchStart + normalizedQuery.length;
		matches.push({
			start: valueIndex.sourceStarts[matchStart],
			end: valueIndex.sourceEnds[matchEnd - 1],
		});
		searchFrom = matchEnd;
	}

	return matches;
}

export function matchesSearchHighlightValue(value: string, query: string): boolean {
	return findNormalizedMatches(value, query, false).length > 0 || findNormalizedMatches(value, query, true).length > 0;
}

export function getSearchHighlightSegments(value: string, query: string): SearchHighlightSegment[] {
	const matches = findNormalizedMatches(value, query, false);
	const effectiveMatches = matches.length > 0 ? matches : findNormalizedMatches(value, query, true);
	if (effectiveMatches.length === 0) return [{ text: value, highlighted: false }];

	const segments: SearchHighlightSegment[] = [];
	let sourceOffset = 0;
	for (const match of effectiveMatches) {
		if (match.start > sourceOffset) {
			segments.push({ text: value.slice(sourceOffset, match.start), highlighted: false });
		}
		segments.push({ text: value.slice(match.start, match.end), highlighted: true });
		sourceOffset = match.end;
	}
	if (sourceOffset < value.length) {
		segments.push({ text: value.slice(sourceOffset), highlighted: false });
	}
	return segments;
}

export type SearchHighlightStore = {
	getSnapshot: () => string;
	subscribe: (listener: () => void) => () => void;
	set: (value: string) => void;
};

export function createSearchHighlightStore(): SearchHighlightStore {
	let currentValue = "";
	const listeners = new Set<() => void>();

	return {
		getSnapshot: () => currentValue,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		set: (value) => {
			if (value === currentValue) return;
			currentValue = value;
			listeners.forEach((listener) => listener());
		},
	};
}

const noopSearchHighlightStore: SearchHighlightStore = {
	getSnapshot: () => "",
	subscribe: () => () => undefined,
	set: () => undefined,
};

const SearchHighlightContext = createContext(noopSearchHighlightStore);

export function SearchHighlightProvider({
	store,
	children,
}: {
	store: SearchHighlightStore;
	children: ReactNode;
}) {
	return <SearchHighlightContext.Provider value={store}>{children}</SearchHighlightContext.Provider>;
}

export function useSearchHighlightQuery(): string {
	const store = useContext(SearchHighlightContext);
	return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function HighlightedSearchText({
	value,
	query,
	markClassName,
}: {
	value: string;
	query?: string;
	markClassName?: string;
}) {
	const contextQuery = useSearchHighlightQuery();
	const effectiveQuery = query ?? contextQuery;

	return getSearchHighlightSegments(value, effectiveQuery).map((segment, index) =>
		segment.highlighted ? (
			<mark key={`${segment.text}-${index}`} className={cn("bg-yellow-200 px-0.5", markClassName)}>
				{segment.text}
			</mark>
		) : (
			<span key={`${segment.text}-${index}`}>{segment.text}</span>
		)
	);
}

export type FormTableSearchProps = {
	searchQuery: string;
	onSearchQueryChange: (value: string) => void;
	onSearchInputChange?: (value: string) => void;
};

/**
 * Owns a table's committed search query plus a highlight store that cell
 * renderers can subscribe to without going through the table config (which
 * would rebuild the whole table on every query change).
 *
 * Wire-up:
 *   const search = useFormTableSearch();
 *   <SearchHighlightProvider store={search.highlightStore}>
 *     <FormTable {...search.searchProps} config={...} />
 *   </SearchHighlightProvider>
 * and render matches inside cells with <HighlightedSearchText value={...} />.
 *
 * Highlights update together with the committed (debounced) query. Pass
 * `liveHighlight: true` to update them on every keystroke instead — avoid it
 * on tables that keep many highlighted cells mounted, since each keystroke
 * then re-renders all of them synchronously.
 */
export function useFormTableSearch(options?: { liveHighlight?: boolean }): {
	searchQuery: string;
	setSearchQuery: (value: string) => void;
	highlightStore: SearchHighlightStore;
	searchProps: FormTableSearchProps;
} {
	const liveHighlight = options?.liveHighlight === true;
	const [searchQuery, setSearchQueryState] = useState("");
	const highlightStore = useMemo(() => createSearchHighlightStore(), []);

	const setSearchQuery = useCallback(
		(value: string) => {
			setSearchQueryState(value);
			highlightStore.set(value);
		},
		[highlightStore]
	);

	const searchProps = useMemo<FormTableSearchProps>(
		() => ({
			searchQuery,
			onSearchQueryChange: setSearchQuery,
			...(liveHighlight ? { onSearchInputChange: highlightStore.set } : {}),
		}),
		[highlightStore, liveHighlight, searchQuery, setSearchQuery]
	);

	return { searchQuery, setSearchQuery, highlightStore, searchProps };
}
