"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RuleType = "on_finish" | "days_after" | "months_after";

type Policy = {
	id: string;
	policy_number: string;
	end_date: string | null;
	cancellation_rule_type: RuleType;
	cancellation_rule_offset: number;
	obra_finished_at: string | null;
	calculated_cancellation_date: string | null;
	is_cancelled: boolean;
	obras?: {
		n?: number | string | null;
		designacion_y_ubicacion?: string | null;
		porcentaje?: number | string | null;
	} | Array<{
		n?: number | string | null;
		designacion_y_ubicacion?: string | null;
		porcentaje?: number | string | null;
	}>;
};

type TenantUser = {
	id: string;
	full_name: string | null;
	email: string | null;
};

const EMPTY_POLICY_FORM = {
	policyNumber: "",
	endDate: "",
	cancellationRuleType: "on_finish" as RuleType,
	cancellationRuleOffset: "0",
};

function formatDate(value: string | null | undefined) {
	if (!value) return "-";
	return value.slice(0, 10);
}

function ruleLabel(type: RuleType, offset: number) {
	if (type === "days_after") return `${offset} días después`;
	if (type === "months_after") return `${offset} meses después`;
	return "Al finalizar obra";
}

export function InsurancePoliciesTab({ obraId }: { obraId: string }) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState(EMPTY_POLICY_FORM);
	const [isSaving, setIsSaving] = useState(false);

	const policiesQuery = useQuery({
		queryKey: ["obra", obraId, "insurance-policies"],
		queryFn: async () => {
			const response = await fetch(`/api/obras/${obraId}/insurance-policies`);
			if (!response.ok) throw new Error("No se pudieron cargar las pólizas");
			return (await response.json()) as { policies: Policy[] };
		},
	});

	const recipientsQuery = useQuery({
		queryKey: ["obra", obraId, "insurance-policy-recipients"],
		queryFn: async () => {
			const response = await fetch(`/api/obra-recipients?obraId=${obraId}`);
			if (!response.ok) return { users: [] as TenantUser[] };
			return (await response.json()) as { users: TenantUser[] };
		},
	});

	const settingsQuery = useQuery({
		queryKey: ["insurance-policies", "settings"],
		queryFn: async () => {
			const response = await fetch("/api/insurance-policies/settings");
			if (!response.ok) return { responsibleUserId: null as string | null };
			return (await response.json()) as { responsibleUserId: string | null };
		},
	});

	async function refreshPolicies() {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["obra", obraId, "insurance-policies"] }),
			queryClient.invalidateQueries({ queryKey: ["insurance-policies", "macro"] }),
		]);
	}

	async function createPolicy() {
		setIsSaving(true);
		try {
			const response = await fetch(`/api/obras/${obraId}/insurance-policies`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					policyNumber: form.policyNumber,
					endDate: form.endDate || null,
					cancellationRuleType: form.cancellationRuleType,
					cancellationRuleOffset: Number(form.cancellationRuleOffset || 0),
				}),
			});
			if (!response.ok) throw new Error((await response.json()).error ?? "No se pudo crear la póliza");
			setForm(EMPTY_POLICY_FORM);
			await refreshPolicies();
			toast.success("Póliza creada");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "No se pudo crear la póliza");
		} finally {
			setIsSaving(false);
		}
	}

	async function toggleCancelled(policy: Policy, checked: boolean) {
		const response = await fetch(`/api/insurance-policies/${policy.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ isCancelled: checked }),
		});
		if (!response.ok) {
			toast.error((await response.json()).error ?? "No se pudo actualizar la póliza");
			return;
		}
		await refreshPolicies();
		toast.success(checked ? "Póliza marcada como dada de baja" : "Baja revertida");
	}

	async function updateResponsible(userId: string) {
		const response = await fetch("/api/insurance-policies/settings", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ responsibleUserId: userId === "none" ? null : userId }),
		});
		if (!response.ok) {
			toast.error((await response.json()).error ?? "No se pudo guardar el responsable");
			return;
		}
		await queryClient.invalidateQueries({ queryKey: ["insurance-policies", "settings"] });
		toast.success("Responsable actualizado");
	}

	const policies = policiesQuery.data?.policies ?? [];
	const users = recipientsQuery.data?.users ?? [];
	const responsibleUserId = settingsQuery.data?.responsibleUserId ?? "none";

	return (
		<div className="space-y-5">
			<section className="border border-stone-200 bg-white">
				<div className="flex flex-col gap-3 border-b border-stone-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
					<div>
						<h2 className="text-sm font-semibold text-stone-900">Pólizas de seguro</h2>
						<p className="text-xs text-stone-500">Asociadas a esta obra</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Select value={responsibleUserId} onValueChange={updateResponsible}>
							<SelectTrigger className="h-9 w-[240px]">
								<SelectValue placeholder="Responsable" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Sin responsable</SelectItem>
								{users.map((user) => (
									<SelectItem key={user.id} value={user.id}>
										{user.full_name || user.email || user.id}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button variant="outline" size="sm" className="gap-2" onClick={() => void refreshPolicies()}>
							<RefreshCw className="size-4" />
						</Button>
					</div>
				</div>

				<div className="grid gap-3 border-b border-stone-200 p-4 md:grid-cols-[1fr_150px_190px_110px_auto] md:items-end">
					<div className="space-y-1.5">
						<Label>Número de póliza</Label>
						<Input value={form.policyNumber} onChange={(event) => setForm((current) => ({ ...current, policyNumber: event.target.value }))} />
					</div>
					<div className="space-y-1.5">
						<Label>Finalización</Label>
						<Input type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
					</div>
					<div className="space-y-1.5">
						<Label>Regla</Label>
						<Select value={form.cancellationRuleType} onValueChange={(value) => setForm((current) => ({ ...current, cancellationRuleType: value as RuleType }))}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="on_finish">Al finalizar obra</SelectItem>
								<SelectItem value="days_after">N días después</SelectItem>
								<SelectItem value="months_after">N meses después</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label>N</Label>
						<Input type="number" min={0} value={form.cancellationRuleOffset} disabled={form.cancellationRuleType === "on_finish"} onChange={(event) => setForm((current) => ({ ...current, cancellationRuleOffset: event.target.value }))} />
					</div>
					<Button className="gap-2" onClick={() => void createPolicy()} disabled={isSaving || !form.policyNumber.trim()}>
						<Plus className="size-4" />
						Agregar
					</Button>
				</div>

				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Número de póliza</TableHead>
								<TableHead>Fecha de finalización</TableHead>
								<TableHead>Regla de vencimiento</TableHead>
								<TableHead>Fecha calculada baja</TableHead>
								<TableHead>Póliza dada de baja</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{policies.map((policy) => (
								<TableRow key={policy.id}>
									<TableCell className="font-medium">{policy.policy_number}</TableCell>
									<TableCell>{formatDate(policy.end_date)}</TableCell>
									<TableCell>{ruleLabel(policy.cancellation_rule_type, policy.cancellation_rule_offset)}</TableCell>
									<TableCell>{formatDate(policy.calculated_cancellation_date)}</TableCell>
									<TableCell>
										<Checkbox checked={policy.is_cancelled} onCheckedChange={(checked) => void toggleCancelled(policy, checked === true)} />
									</TableCell>
								</TableRow>
							))}
							{policies.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} className="h-24 text-center text-sm text-stone-500">
										No hay pólizas cargadas para esta obra.
									</TableCell>
								</TableRow>
							) : null}
						</TableBody>
					</Table>
				</div>
			</section>

		</div>
	);
}
