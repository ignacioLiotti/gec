import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface InBodyStatesProps {
	isLoading: boolean;
	tableError: string | null;
	colspan: number;
	empty: boolean;
	onRetry: () => void;
	emptyText: string;
}

export function InBodyStates({
	isLoading,
	tableError,
	colspan,
	empty,
	onRetry,
	emptyText,
}: InBodyStatesProps) {
	if (isLoading && empty) {
		return (
			<tr>
				<td colSpan={colspan} className="px-4 py-16 text-center border-t border-border">
					<div className="flex flex-col items-center gap-3">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
						<p className="text-sm text-muted-foreground">Cargando datos...</p>
					</div>
				</td>
			</tr>
		);
	}

	if (tableError) {
		return (
			<tr>
				<td colSpan={colspan} className="px-4 py-16 text-center border-t border-border">
					<div className="flex flex-col items-center gap-3">
						<p className="text-sm text-destructive">
							Error al cargar los datos: {tableError}
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={onRetry}
							className="gap-2"
						>
							<RefreshCw className="h-4 w-4" />
							Reintentar
						</Button>
					</div>
				</td>
			</tr>
		);
	}

	if (empty) {
		return (
			<tr>
				<td colSpan={colspan} className="px-4 py-16 text-center border-t border-border">
					<p className="text-sm text-muted-foreground">{emptyText}</p>
				</td>
			</tr>
		);
	}

	return null;
}
