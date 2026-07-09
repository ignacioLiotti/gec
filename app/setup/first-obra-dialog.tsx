"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HardHat, Loader2 } from "lucide-react";
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

function toNonNegativeNumber(value: string) {
	const parsed = Number(value.replace(",", "."));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function FirstObraDialog({ nextObraNumber }: { nextObraNumber: number }) {
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

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!name.trim() || !client.trim() || !basicMonth || !startDate) {
			toast.error("Completá los cuatro datos obligatorios para continuar.");
			return;
		}

		setSaving(true);
		try {
			const contract = toNonNegativeNumber(contractAmount);
			const term = toNonNegativeNumber(termMonths);
			const response = await fetch("/api/obras/bulk", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					updates: [
						{
							n: nextObraNumber,
							designacionYUbicacion: name.trim(),
							supDeObraM2: toNonNegativeNumber(surface),
							entidadContratante: client.trim(),
							mesBasicoDeContrato: `${basicMonth}-01`,
							iniciacion: startDate,
							contratoMasAmpliaciones: contract,
							certificadoALaFecha: 0,
							saldoACertificar: contract,
							segunContrato: term,
							prorrogasAcordadas: 0,
							plazoTotal: term,
							plazoTransc: 0,
							porcentaje: 0,
							customData: specialty.trim()
								? { especialidad: specialty.trim() }
								: {},
						},
					],
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

			toast.success("Primera obra creada. Ya podés empezar a trabajar.");
			setOpen(false);
			router.push("/excel");
			router.refresh();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No pudimos crear la obra.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}>
			<DialogTrigger asChild>
				<Button className="w-full sm:w-auto">
					Crear mi primera obra
					<HardHat className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Tu primera obra</DialogTitle>
						<DialogDescription>
							Completá lo esencial. Después vas a poder agregar más datos desde la tabla principal.
						</DialogDescription>
					</DialogHeader>

					<div className="mt-5 grid gap-4 sm:grid-cols-2">
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
						</div>
						<div className="space-y-2">
							<Label htmlFor="first-obra-contract">Monto de contrato</Label>
							<Input id="first-obra-contract" inputMode="decimal" value={contractAmount} onChange={(event) => setContractAmount(event.target.value)} placeholder="0" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="first-obra-term">Plazo en meses</Label>
							<Input id="first-obra-term" inputMode="numeric" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} placeholder="0" />
						</div>
					</div>

					<div className="mt-5 rounded-lg border border-stroke-soft bg-surface-recessed px-4 py-3 text-sm text-content-secondary shadow-inner">
						Se asignará el número <strong className="text-content">{nextObraNumber}</strong> y se crearán automáticamente las carpetas y tablas del modelo recomendado.
					</div>

					<DialogFooter className="mt-6">
						<Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
							Cancelar
						</Button>
						<Button type="submit" disabled={saving}>
							{saving ? <Loader2 className="size-4 animate-spin" /> : <HardHat className="size-4" />}
							{saving ? "Creando obra…" : "Crear obra"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
