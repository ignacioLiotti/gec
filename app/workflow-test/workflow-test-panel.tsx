"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type WorkflowTestPanelProps = {
	defaultEmail: string;
};

export function WorkflowTestPanel({ defaultEmail }: WorkflowTestPanelProps) {
	const [recipient, setRecipient] = useState(defaultEmail);
	const [subject, setSubject] = useState("Workflow test email");
	const [message, setMessage] = useState(
		"Hola! Este es un correo de prueba enviado por un workflow."
	);
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const triggerWorkflow = (variant: "immediate" | "delay") => {
		setStatus(null);
		setError(null);

		startTransition(async () => {
			try {
				const response = await fetch("/api/workflow-test", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						variant,
						recipient,
						subject,
						message,
					}),
				});

				const data = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(data?.error || "No se pudo iniciar el workflow.");
				}

				setStatus(
					data?.variant === "delay"
						? "Workflow programado: recibirás el correo en ~5 minutos."
						: "Workflow enviado: revisa tu bandeja en unos segundos."
				);
			} catch (err: any) {
				setError(err?.message || "Fallo el trigger del workflow.");
			}
		});
	};

	return (
		<div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
			<div className="grid gap-4">
				<div className="space-y-2">
					<Label htmlFor="wf-recipient">Email de destino</Label>
					<Input
						id="wf-recipient"
						type="email"
						value={recipient}
						onChange={(event) => setRecipient(event.target.value)}
						placeholder="tucorreo@ejemplo.com"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="wf-subject">Asunto</Label>
					<Input
						id="wf-subject"
						value={subject}
						onChange={(event) => setSubject(event.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="wf-message">Mensaje</Label>
					<Textarea
						id="wf-message"
						value={message}
						rows={5}
						onChange={(event) => setMessage(event.target.value)}
					/>
				</div>
			</div>

			<div className="flex flex-wrap gap-3">
				<Button
					type="button"
					onClick={() => triggerWorkflow("immediate")}
					disabled={isPending || !recipient}
				>
					Enviar ahora
				</Button>
				<Button
					type="button"
					variant="secondary"
					onClick={() => triggerWorkflow("delay")}
					disabled={isPending || !recipient}
				>
					Enviar en 5 minutos
				</Button>
			</div>

			{status ? (
				<p className="text-sm text-emerald-600">{status}</p>
			) : null}
			{error ? <p className="text-sm text-red-600">{error}</p> : null}
		</div>
	);
}
