"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Command,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
} from "@/components/ui/command";
import { useObrasSearch } from "../_hooks/use-obras-search";

interface ObraComboboxProps {
	value: string | null;
	displayName: string | null;
	onSelect: (id: string, name: string) => void;
}

export function ObraCombobox({ value, displayName, onSelect }: ObraComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const { obras, isLoading } = useObrasSearch(search);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between font-normal"
				>
					<span className="truncate">
						{value ? displayName ?? value : "Seleccionar obra..."}
					</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[400px] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Buscar obra..."
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList>
						{isLoading ? (
							<div className="py-6 text-center text-sm text-muted-foreground">
								Buscando...
							</div>
						) : search.length === 0 ? (
							<div className="py-6 text-center text-sm text-muted-foreground">
								Escriba para buscar obras
							</div>
						) : (
							<>
								<CommandEmpty>No se encontraron obras.</CommandEmpty>
								<CommandGroup>
									{obras.map((obra) => {
										const label = `#${obra.n} - ${obra.designacionYUbicacion}`;
										return (
											<CommandItem
												key={obra.id}
												value={obra.id}
												onSelect={() => {
													onSelect(obra.id, label);
													setOpen(false);
													setSearch("");
												}}
											>
												<span className="font-medium">#{obra.n}</span>
												<span className="truncate text-muted-foreground">
													{obra.designacionYUbicacion}
												</span>
											</CommandItem>
										);
									})}
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
