"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, HardHat, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseArgentineNumber } from "@/lib/locale-number";

export function FirstObraDialog({
	repairObra = null,
}: {
	repairObra?: { id: string; n: number } | null;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [name, setName] = useState("");
	const [client, setClient] = useState("");
	const [specialty, setSpecialty] = useState("");
	const [basicMonth, setBasicMonth] = useState("");
	const [startDate, setStartDate] = useState("");
	const [surface, setSurface] = useState("");
	const [contractAmount, setContractAmount] = useState("");
	const [termMonths, setTermMonths] = useState("");
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [partialObra, setPartialObra] = useState<{ id: string; n: number } | null>(
		repairObra,
	);

	async function retryProvisioning() {
		if (!partialObra) return;
		setSaving(true);
		try {
			const response = await fetch("/api/obras/backfill-defaults", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ obraIds: [partialObra.id] }),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || payload.ok !== true) {
				throw new Error("La obra existe, pero todavía falta completar su estructura. Volvé a intentarlo.");
			}
			toast.success("La estructura de la obra quedó lista.");
			setPartialObra(null);
			setOpen(false);
			router.refresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No pudimos completar la estructura.");
		} finally {
			setSaving(false);
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!name.trim() || !client.trim() || !basicMonth || !startDate) {
			toast.error("Completá los cuatro datos obligatorios para continuar.");
			return;
		}

		const parsedSurface = parseArgentineNumber(surface);
		const parsedContract = parseArgentineNumber(contractAmount);
		const parsedTerm = parseArgentineNumber(termMonths);
		const nextErrors: Record<string, string> = {};
		if (parsedSurface === null) nextErrors.surface = "Ingresá un número válido, por ejemplo 1.250,50.";
		if (parsedContract === null) nextErrors.contract = "Ingresá un monto válido, por ejemplo 12.500.000,00.";
		if (parsedTerm === null || !Number.isInteger(parsedTerm)) nextErrors.term = "Ingresá una cantidad entera de meses.";
		if (Object.keys(nextErrors).length > 0) {
			setFieldErrors(nextErrors);
			return;
		}
		setFieldErrors({});

		setSaving(true);
		try {
			const response = await fetch("/api/obras/first", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					designacionYUbicacion: name.trim(),
					supDeObraM2: parsedSurface,
					entidadContratante: client.trim(),
					mesBasicoDeContrato: `${basicMonth}-01`,
					iniciacion: startDate,
					contratoMasAmpliaciones: parsedContract,
					segunContrato: parsedTerm,
					especialidad: specialty.trim() || undefined,
				}),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(
					typeof payload.error === "string"
						? payload.error
						: "No pudimos crear la obra.",
				);
			}
			if (payload.provisioning?.status === "partial" && payload.obra?.id) {
				setPartialObra({ id: payload.obra.id, n: Number(payload.obra.n) });
				toast.warning("La obra fue creada, pero falta completar parte de su estructura.");
				return;
			}

			toast.success("Primera obra creada. Ya podés empezar a trabajar.");
			setOpen(false);
			router.refresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No pudimos crear la obra.");
		} finally {
			setSaving(false);
		}
	}

	if (repairObra) {
		return (
			<Button
				type="button"
				className="w-full sm:w-auto"
				onClick={retryProvisioning}
				disabled={saving}
			>
				{saving ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<AlertTriangle className="size-4" />
				)}
				{saving ? "Verificando…" : "Reintentar configuración"}
			</Button>
		);
	}

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}>
			<DialogTrigger asChild>
				<Button className="w-full sm:w-auto">
					Crear mi primera obra
					<HardHat className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[92dvh] overflow-hidden sm:max-w-2xl">
				<form onSubmit={handleSubmit} className="flex max-h-[92dvh] flex-col">
					<DialogHeader>
						<DialogTitle>Tu primera obra</DialogTitle>
						<DialogDescription>
							Completá lo esencial. Después vas a poder agregar más datos desde la tabla principal.
						</DialogDescription>
					</DialogHeader>

					<div className="grid min-h-0 gap-4 overflow-y-auto px-4 py-5 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="first-obra-name">Nombre y ubicación *</Label>
							<Input id="first-obra-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Escuela N° 18 — Resistencia" autoFocus required />
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="first-obra-client">Entidad contratante *</Label>
							<Input id="first-obra-client" value={client} onChange={(event) => setClient(event.target.value)} placeholder="Ej.: Ministerio de Obras Públicas" required />
						</div>
						<div className="space-y-2">
							<Label htmlFor="first-obra-basic-month">Mes básico *</Label>
							<Input id="first-obra-basic-month" type="month" value={basicMonth} onChange={(event) => setBasicMonth(event.target.value)} required />
						</div>
						<div className="space-y-2">
							<Label htmlFor="first-obra-start">Fecha de inicio *</Label>
							<Input id="first-obra-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
						</div>
						<div className="space-y-2">
							<Label htmlFor="first-obra-specialty">Especialidad</Label>
							<Input id="first-obra-specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder="Ej.: Arquitectura" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="first-obra-surface">Superficie (m²)</Label>
							<Input id="first-obra-surface" inputMode="decimal" value={surface} onChange={(event) => setSurface(event.target.value)} placeholder="0" />
							{fieldErrors.surface && <p className="text-xs text-destructive">{fieldErrors.surface}</p>}
						</div>
						<div className="space-y-2">
							<Label htmlFor="first-obra-contract">Monto de contrato</Label>
							<Input id="first-obra-contract" inputMode="decimal" value={contractAmount} onChange={(event) => setContractAmount(event.target.value)} placeholder="Ej.: 12.500.000,00" />
							{fieldErrors.contract && <p className="text-xs text-destructive">{fieldErrors.contract}</p>}
						</div>
						<div className="space-y-2">
							<Label htmlFor="first-obra-term">Plazo en meses</Label>
							<Input id="first-obra-term" inputMode="numeric" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} placeholder="0" />
							{fieldErrors.term && <p className="text-xs text-destructive">{fieldErrors.term}</p>}
						</div>
						<div className="rounded-lg border border-stroke-soft bg-surface-recessed px-4 py-3 text-sm text-content-secondary shadow-inner sm:col-span-2">
							El número se asignará de forma segura al guardar. Después prepararemos las carpetas y tablas recomendadas.
						</div>
						{partialObra && (
							<div className="flex gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 sm:col-span-2">
								<AlertTriangle className="mt-0.5 size-4 shrink-0" />
								<p>La obra N° {partialObra.n} ya existe. Reintentá la configuración; no se creará otra obra.</p>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
							{partialObra ? "Cerrar" : "Cancelar"}
						</Button>
						<Button type={partialObra ? "button" : "submit"} onClick={partialObra ? retryProvisioning : undefined} disabled={saving}>
							{saving ? <Loader2 className="size-4 animate-spin" /> : <HardHat className="size-4" />}
							{saving ? "Preparando…" : partialObra ? "Reintentar configuración" : "Crear obra"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
