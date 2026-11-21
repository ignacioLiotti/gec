import { useCallback, useEffect, useState, useTransition } from "react";

const SEARCH_COMMIT_DEBOUNCE_MS = 220;

export function useTableSearch({
	searchQuery,
	onSearchQueryChange,
	onSearchInputChange,
	onCommit,
}: {
	searchQuery?: string;
	onSearchQueryChange?: (value: string) => void;
	onSearchInputChange?: (value: string) => void;
	onCommit: () => void;
}) {
	const controlledValue = typeof searchQuery === "string" ? searchQuery : null;
	const [search, setSearch] = useState(() => ({
		input: controlledValue ?? "",
		committed: controlledValue ?? "",
		controlledValue,
		emitted: [] as string[],
	}));
	const [isSearchTransitioning, startSearchTransition] = useTransition();

	if (search.controlledValue !== controlledValue) {
		// A delayed parent echo must not replace keystrokes typed after that commit.
		const isEcho = controlledValue !== null && search.emitted.includes(controlledValue);
		setSearch({
			input: controlledValue === null || isEcho ? search.input : controlledValue,
			committed: controlledValue === null || isEcho ? search.committed : controlledValue,
			controlledValue,
			emitted: isEcho ? search.emitted.filter((value) => value !== controlledValue) : [],
		});
	}
	const handleSearchInputChange = useCallback(
		(input: string) => {
			if (input === search.input) return;
			setSearch((current) => ({ ...current, input }));
			onSearchInputChange?.(input);
		},
		[search.input, onSearchInputChange]
	);

	const { input, committed } = search;
	const isControlled = controlledValue !== null;
	useEffect(() => {
		if (input === committed) return;
		const timeout = window.setTimeout(() => {
			onCommit();
			startSearchTransition(() => {
				setSearch((current) => ({
					...current,
					committed: input,
					emitted: isControlled ? [...current.emitted, input] : [],
				}));
				if (isControlled) onSearchQueryChange?.(input);
			});
		}, SEARCH_COMMIT_DEBOUNCE_MS);
		return () => window.clearTimeout(timeout);
	}, [input, committed, isControlled, onCommit, onSearchQueryChange]);

	return {
		searchInputValue: input,
		searchRequestKey: committed.trim(),
		isSearchInputLag: input.trim() !== committed.trim(),
		isSearchTransitioning,
		handleSearchInputChange,
	};
}
