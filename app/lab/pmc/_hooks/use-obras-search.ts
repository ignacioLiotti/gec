"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type ObraSearchResult = {
	id: string;
	n: number;
	designacionYUbicacion: string;
};

export function useObrasSearch(query: string) {
	const [debouncedQuery, setDebouncedQuery] = useState(query);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 300);
		return () => clearTimeout(timer);
	}, [query]);

	const result = useQuery<{ detalleObras: ObraSearchResult[] }>({
		queryKey: ["obras-search", debouncedQuery],
		queryFn: async () => {
			const params = new URLSearchParams({
				q: debouncedQuery,
				limit: "20",
				page: "1",
			});
			const res = await fetch(`/api/obras?${params}`, { cache: "no-store" });
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.error ?? "Failed to search obras");
			}
			return res.json();
		},
		enabled: debouncedQuery.length > 0,
		staleTime: 60_000,
	});

	return {
		obras: result.data?.detalleObras ?? [],
		isLoading: result.isLoading,
	};
}
