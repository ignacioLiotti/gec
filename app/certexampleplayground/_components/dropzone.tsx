"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DropzoneProps = {
	onFile: (file: File) => void;
	isLoading: boolean;
};

export function Dropzone({ onFile, isLoading }: DropzoneProps) {
	const [isDragOver, setIsDragOver] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(
		(file: File) => {
			if (
				file.name.endsWith(".xlsx") ||
				file.name.endsWith(".xls")
			) {
				onFile(file);
			} else {
				toast.error("Solo se aceptan archivos Excel (.xlsx, .xls)");
			}
		},
		[onFile]
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			const file = e.dataTransfer.files[0];
			if (file) handleFile(file);
		},
		[handleFile]
	);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) handleFile(file);
		},
		[handleFile]
	);

	return (
		<div
			className={cn(
				"relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer",
				isDragOver
					? "border-orange-500 bg-orange-50"
					: "border-border hover:border-orange-300 hover:bg-orange-50/30",
				isLoading && "pointer-events-none opacity-60"
			)}
			onDragOver={(e) => {
				e.preventDefault();
				setIsDragOver(true);
			}}
			onDragLeave={() => setIsDragOver(false)}
			onDrop={handleDrop}
			onClick={() => inputRef.current?.click()}
		>
			<input
				ref={inputRef}
				type="file"
				accept=".xlsx,.xls"
				className="hidden"
				onChange={handleInputChange}
			/>
			{isLoading ? (
				<>
					<Loader2 className="h-10 w-10 animate-spin text-orange-500" />
					<p className="text-sm font-medium text-muted-foreground">
						Analizando archivo...
					</p>
				</>
			) : (
				<>
					<Upload className="h-10 w-10 text-muted-foreground" />
					<div className="text-center">
						<p className="text-sm font-medium">
							Arrastrá tu certificado Excel aquí
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							o hacé clic para seleccionar (.xlsx, .xls)
						</p>
					</div>
				</>
			)}
		</div>
	);
}
