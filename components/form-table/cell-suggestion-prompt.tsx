import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import type { CellSuggestion, FormTableRow } from "./types";

export function buildSuggestionKey<Row extends FormTableRow>(
	suggestion: CellSuggestion<Row> | null
) {
	if (!suggestion) return null;
	return `${suggestion.kind}:${suggestion.sourceInput}:${suggestion.suggestedDisplayValue}`;
}

export function CellSuggestionPrompt<Row extends FormTableRow>({
	suggestion,
	onApply,
	onIgnore,
	className,
}: {
	suggestion: CellSuggestion<Row> | null;
	onApply: () => void;
	onIgnore: () => void;
	className?: string;
}) {
	const [open, setOpen] = useState(false);

	if (!suggestion) return null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="defaultSecondary"
					size="sm"
					className={cn(
						"pointer-events-all absolute right-9 z-20 inline-flex h-6 items-center px-1 text-[10px] font-semibold uppercase tracking-wide",
						className
					)}
				>
					<Sparkles className="-mr-1 -ml-1 size-3 py-0.5 font-normal" />
					Sugerencia
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" side="bottom" className="w-72 p-0">
				<div className="border-b bg-orange-50/70 px-4 py-3">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
						Sugerencia automática
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">{suggestion.description}</p>
				</div>
				<div className="space-y-3 px-4 py-3 text-sm">
					<div className="flex items-center gap-2">
						<div className="min-w-0 flex-1 rounded-lg border bg-muted/30 px-3 py-2">
							<p className="text-[10px] uppercase tracking-wide text-muted-foreground">Detectado</p>
							<p className="mt-0.5 truncate font-medium text-foreground">
								{suggestion.sourceInput}
							</p>
						</div>
						<ArrowRight className="size-4 shrink-0 text-muted-foreground" />
						<div className="min-w-0 flex-1 rounded-lg border-2 border-orange-300 bg-orange-50 px-3 py-2">
							<p className="text-[10px] uppercase tracking-wide text-orange-600">Sugerido</p>
							<p className="mt-0.5 truncate font-semibold text-orange-900">
								{suggestion.suggestedDisplayValue}
							</p>
						</div>
					</div>
					<div className="flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onPointerDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onIgnore();
								setOpen(false);
							}}
						>
							Ignorar
						</Button>
						<Button
							type="button"
							size="sm"
							onPointerDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onApply();
								setOpen(false);
							}}
						>
							Aplicar
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
