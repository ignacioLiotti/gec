"use client";

import { useMemo, useState } from "react";

interface FlowBuilderClientProps {
	initialPeriod: string;
	pmcTemplate: string;
}

type ValidationResponse = {
	validation: { valid: boolean; errors: string[] };
	instance?: any;
};

type FlowStateResponse = {
	steps: Array<{
		stepId: string;
		status: string;
		reason?: any;
		inputs?: any;
		outputs?: any;
	}>;
	plannedJobs?: Array<{ type: string; stepId: string }>;
};

export function FlowBuilderClient({ initialPeriod, pmcTemplate }: FlowBuilderClientProps) {
	const [obraId, setObraId] = useState("");
	const [period, setPeriod] = useState(initialPeriod);
	const [definitionJson, setDefinitionJson] = useState(pmcTemplate);
	const [validation, setValidation] = useState<ValidationResponse | null>(null);
	const [state, setState] = useState<FlowStateResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const parsedDefinition = useMemo(() => {
		try {
			return JSON.parse(definitionJson);
		} catch {
			return null;
		}
	}, [definitionJson]);

	async function validateDefinition() {
		setError(null);
		setLoading(true);
		try {
			if (!parsedDefinition) throw new Error("JSON invalido");
			const res = await fetch("/api/flows/definition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "validate",
					definitionJson: parsedDefinition,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error ?? "Failed to validate");
			setValidation(data);
		} catch (err: any) {
			setError(err?.message ?? "Failed to validate");
		} finally {
			setLoading(false);
		}
	}

	async function saveDefinition() {
		setError(null);
		setLoading(true);
		try {
			if (!obraId) throw new Error("Obra ID requerido");
			if (!parsedDefinition) throw new Error("JSON invalido");
			const res = await fetch("/api/flows/definition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "set",
					obraId,
					definitionJson: parsedDefinition,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error ?? "Failed to save definition");
			setValidation(data);
		} catch (err: any) {
			setError(err?.message ?? "Failed to save definition");
		} finally {
			setLoading(false);
		}
	}

	async function applyAndEvaluate() {
		setError(null);
		setLoading(true);
		try {
			if (!obraId || !period) throw new Error("Obra ID y periodo requeridos");
			if (!parsedDefinition) throw new Error("JSON invalido");

			const saveRes = await fetch("/api/flows/definition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "set",
					obraId,
					definitionJson: parsedDefinition,
				}),
			});
			const saveData = await saveRes.json();
			if (!saveRes.ok) throw new Error(saveData?.error ?? "Failed to save definition");
			setValidation(saveData);

			const stateRes = await fetch(
				`/api/flows/state?obraId=${encodeURIComponent(obraId)}&period=${encodeURIComponent(period)}`,
				{ cache: "no-store" },
			);
			const stateData = await stateRes.json();
			if (!stateRes.ok) throw new Error(stateData?.error ?? "Failed to evaluate");
			setState(stateData);
		} catch (err: any) {
			setError(err?.message ?? "Failed to evaluate");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
			<div className="space-y-4">
				<label className="flex flex-col gap-2 text-sm">
					<span>Flow definition JSON</span>
					<textarea
						className="min-h-[420px] rounded border px-3 py-2 font-mono text-xs"
						value={definitionJson}
						onChange={(event) => setDefinitionJson(event.target.value)}
					/>
				</label>
				<div className="flex flex-wrap gap-2">
					<button
						className="rounded border px-3 py-2"
						onClick={() => setDefinitionJson(pmcTemplate)}
						disabled={loading}
					>
						Load PMC v1
					</button>
					<button
						className="rounded border px-3 py-2"
						onClick={validateDefinition}
						disabled={loading}
					>
						Validate
					</button>
					<button
						className="rounded border px-3 py-2"
						onClick={saveDefinition}
						disabled={loading}
					>
						Save for obra
					</button>
					<button
						className="rounded bg-black px-3 py-2 text-white"
						onClick={applyAndEvaluate}
						disabled={loading}
					>
						Apply and evaluate
					</button>
				</div>
			</div>

			<div className="space-y-4">
				<div className="grid gap-4">
					<label className="flex flex-col gap-2 text-sm">
						<span>Obra ID</span>
						<input
							className="rounded border px-3 py-2"
							value={obraId}
							onChange={(event) => setObraId(event.target.value)}
							placeholder="UUID de obra"
						/>
					</label>
					<label className="flex flex-col gap-2 text-sm">
						<span>Periodo (YYYY-MM)</span>
						<input
							className="rounded border px-3 py-2"
							value={period}
							onChange={(event) => setPeriod(event.target.value)}
						/>
					</label>
				</div>

				{error ? (
					<div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
						{error}
					</div>
				) : null}

				{validation ? (
					<div className="rounded border p-3 text-sm">
						<div className="font-medium">Validation</div>
						<div className="mt-2 text-xs">
							{validation.validation.valid ? "OK" : "Errors"}
						</div>
						{validation.validation.errors.length ? (
							<ul className="mt-2 list-disc pl-5 text-xs">
								{validation.validation.errors.map((err) => (
									<li key={err}>{err}</li>
								))}
							</ul>
						) : null}
					</div>
				) : null}

				{state ? (
					<div className="space-y-3">
						<div className="font-medium">Flow state</div>
						{state.steps.map((step) => (
							<div key={step.stepId} className="rounded border p-3">
								<div className="flex items-center justify-between text-sm">
									<span>{step.stepId}</span>
									<span className="text-xs uppercase text-slate-500">
										{step.status}
									</span>
								</div>
								{step.reason ? (
									<pre className="mt-2 rounded bg-slate-50 p-2 text-xs">
										{JSON.stringify(step.reason, null, 2)}
									</pre>
								) : null}
							</div>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}
