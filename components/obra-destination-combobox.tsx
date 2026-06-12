"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ObraDestinationOption = {
	id: string;
	n: number | string | null;
	designacionYUbicacion: string;
};

function normalizeSearch(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

function getObraLabel(obra: ObraDestinationOption) {
	return `${obra.n ?? "-"} - ${obra.designacionYUbicacion || "Sin designacion"}`;
}

function scoreObra(obra: ObraDestinationOption, query: string) {
	const normalizedQuery = normalizeSearch(query);
	if (!normalizedQuery) return 1;

	const numberText = normalizeSearch(String(obra.n ?? ""));
	const nameText = normalizeSearch(obra.designacionYUbicacion);
	const labelText = normalizeSearch(getObraLabel(obra));
	const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

	if (!tokens.every((token) => labelText.includes(token))) return 0;
	if (numberText === normalizedQuery) return 1000;
	if (numberText.startsWith(normalizedQuery)) return 900 - numberText.length;
	if (nameText.startsWith(normalizedQuery)) return 800 - nameText.length / 100;
	if (labelText.startsWith(normalizedQuery)) return 700 - labelText.length / 100;

	return tokens.reduce((score, token) => {
		const index = labelText.indexOf(token);
		return score + (index >= 0 ? Math.max(1, 120 - index) : 0);
	}, 0);
}

export function ObraDestinationCombobox({
	obras,
	value,
	onChange,
	excludedObraId,
	disabled,
	placeholder = "Seleccionar obra",
	loadingPlaceholder = "Cargando obras...",
}: {
	obras: ObraDestinationOption[];
	value: string;
	onChange: (value: string) => void;
	excludedObraId?: string | null;
	disabled?: boolean;
	placeholder?: string;
	loadingPlaceholder?: string;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const availableObras = useMemo(
		() => obras.filter((obra) => obra.id && obra.id !== excludedObraId),
		[excludedObraId, obras],
	);
	const selectedObra = availableObras.find((obra) => obra.id === value) ?? null;
	const rankedObras = useMemo(() => {
		return availableObras
			.map((obra) => ({ obra, score: scoreObra(obra, search) }))
			.filter((entry) => entry.score > 0)
			.toSorted((left, right) => {
				if (right.score !== left.score) return right.score - left.score;
				return getObraLabel(left.obra).localeCompare(getObraLabel(right.obra), "es", { numeric: true });
			})
			.slice(0, 40)
			.map((entry) => entry.obra);
	}, [availableObras, search]);
	const isDisabled = disabled || availableObras.length === 0;

	return (
		<Popover open={open} onOpenChange={(nextOpen) => {
			setOpen(nextOpen);
			if (!nextOpen) setSearch("");
		}}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={isDisabled}
					className="h-10 w-full min-w-0 justify-between rounded-lg border-stone-200 bg-white px-3 text-sm font-normal text-stone-800 shadow-xs hover:bg-white disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400"
				>
					<span className={cn("min-w-0 flex-1 truncate text-left", !selectedObra && "text-stone-400")}>
						{disabled ? loadingPlaceholder : selectedObra ? getObraLabel(selectedObra) : placeholder}
					</span>
					<ChevronsUpDown className="ml-2 size-4 shrink-0 text-stone-400" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={6}
				className="w-[var(--radix-popover-trigger-width)] min-w-[min(28rem,calc(100vw-2rem))] max-w-[min(42rem,calc(100vw-2rem))] p-0"
			>
				<Command shouldFilter={false}>
					<CommandInput
						value={search}
						onValueChange={setSearch}
						placeholder="Escribir numero o nombre de obra..."
					/>
					<CommandList className="max-h-[18rem]">
						<CommandEmpty>No se encontro ninguna obra.</CommandEmpty>
						{rankedObras.map((obra) => (
							<CommandItem
								key={obra.id}
								value={obra.id}
								onSelect={() => {
									onChange(obra.id);
									setOpen(false);
									setSearch("");
								}}
								className="w-full min-w-0 items-start gap-3 px-3 py-2"
							>
								<Check
									className={cn(
										"mt-0.5 size-4 shrink-0 text-orange-600",
										value === obra.id ? "opacity-100" : "opacity-0",
									)}
								/>
								<span className="min-w-0 text-xs font-medium leading-snug text-stone-800">
									{getObraLabel(obra)}
								</span>
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
