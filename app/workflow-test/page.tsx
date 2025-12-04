import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WorkflowTestPanel } from "./workflow-test-panel";

const workflowTestsDisabled =
	process.env.WORKFLOW_TEST_DISABLED === "1" ||
	process.env.WORKFLOW_TEST_ENABLED === "0";

export default async function WorkflowTestPage() {
	if (workflowTestsDisabled) {
		notFound();
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return (
			<div className="p-6 text-sm">
				Inicia sesión para acceder al panel de testing de workflows.
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
			<div>
				<h1 className="text-2xl font-semibold">Workflow Email Testing</h1>
				<p className="text-sm text-muted-foreground">
					Usa este panel para disparar workflows simples de envío de emails. El
					primero envía inmediatamente y el segundo espera 5 minutos antes de
					mandar el correo.
				</p>
			</div>
			<WorkflowTestPanel defaultEmail={user.email ?? ""} />
		</div>
	);
}
