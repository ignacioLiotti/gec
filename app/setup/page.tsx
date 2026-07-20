import Link from "next/link";
import { redirect } from "next/navigation";
import {
	ArrowRight,
	Building2,
	Check,
	Circle,
	FolderTree,
	HardHat,
	Sparkles,
	Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveTenantMembership } from "@/lib/tenant-selection";
import { getTenantSetupStatus } from "@/lib/tenant-setup-status";
import { hasPermission } from "@/lib/route-guard";
import { createClient } from "@/utils/supabase/server";
import { FirstObraDialog } from "./first-obra-dialog";

type SetupStep = {
	id: string;
	title: string;
	description: string;
	ready: boolean;
	href: string;
	action: string;
	icon: typeof Building2;
	optional?: boolean;
	available?: boolean;
};

function SetupLoadError() {
	return (
		<div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
			<section className="rounded-xl border border-stroke-soft bg-card p-6 text-center shadow-card">
				<h1 className="text-xl font-semibold text-content">No pudimos revisar la puesta en marcha</h1>
				<p className="mt-2 text-sm leading-6 text-content-secondary">
					Tus datos no se modificaron. Puede ser un problema momentáneo de conexión o permisos.
				</p>
				<Button asChild className="mt-5">
					<Link href="/setup">Volver a intentar</Link>
				</Button>
			</section>
		</div>
	);
}

export default async function TenantSetupPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/");

	const { data: memberships, error: membershipsError } = await supabase
		.from("memberships")
		.select("tenant_id, role")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });
	if (membershipsError) return <SetupLoadError />;
	const { tenantId, activeMembership } = await resolveTenantMembership(memberships);

	if (!tenantId) redirect("/onboarding");
	const isMembershipAdmin =
		activeMembership?.role === "owner" || activeMembership?.role === "admin";
	const [canManageWorkspace, canManageUsers] = isMembershipAdmin
		? [true, true]
		: await Promise.all([
			hasPermission("admin:obra-defaults"),
			hasPermission("admin:users"),
		]);

	const [
		tenantResult,
		foldersResult,
		tablesResult,
		mainTableResult,
		rolesResult,
		macrosResult,
		obrasResult,
		teamResult,
	] = await Promise.all([
		supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
		supabase.from("obra_default_folders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
		supabase.from("obra_default_tablas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
		supabase.from("tenant_main_table_configs").select("tenant_id").eq("tenant_id", tenantId).maybeSingle(),
		supabase.from("roles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
		supabase.from("macro_tables").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
		supabase
			.from("obras")
			.select("id, n", { count: "exact" })
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.order("n", { ascending: false })
			.limit(1),
		supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenantId),
	]);

	const setupQueryError = [
		tenantResult.error,
		foldersResult.error,
		tablesResult.error,
		mainTableResult.error,
		rolesResult.error,
		macrosResult.error,
		obrasResult.error,
		teamResult.error,
	].find(Boolean);
	if (setupQueryError) return <SetupLoadError />;

	const blueprintResult = await supabase
		.from("tenants")
		.select(
			"setup_blueprint_key, setup_blueprint_version, setup_blueprint_applied_at",
		)
		.eq("id", tenantId)
		.maybeSingle();
	const blueprintSchemaUnavailable =
		blueprintResult.error?.code === "PGRST204" ||
		blueprintResult.error?.code === "PGRST205" ||
		blueprintResult.error?.message?.includes("setup_blueprint_key");
	if (blueprintResult.error && !blueprintSchemaUnavailable) {
		return <SetupLoadError />;
	}

	const firstObra = obrasResult.data?.[0] ?? null;
	const requiresProvisioningHealth = Boolean(
		blueprintResult.data?.setup_blueprint_applied_at,
	);
	let firstObraProvisioningStatus: "running" | "partial" | "ready" | null = null;
	if (requiresProvisioningHealth && firstObra?.id) {
		const provisioningResult = await supabase
			.from("obra_setup_provisioning")
			.select("status")
			.eq("obra_id", firstObra.id)
			.maybeSingle();
		if (provisioningResult.error) return <SetupLoadError />;
		if (
			provisioningResult.data?.status === "running" ||
			provisioningResult.data?.status === "partial" ||
			provisioningResult.data?.status === "ready"
		) {
			firstObraProvisioningStatus = provisioningResult.data.status;
		}
	}

	const folderCount = foldersResult.count ?? 0;
	const tableCount = tablesResult.count ?? 0;
	const roleCount = rolesResult.count ?? 0;
	const macroCount = macrosResult.count ?? 0;
	const obraCount = obrasResult.count ?? 0;
	const memberCount = teamResult.count ?? 0;
	const setupStatus = getTenantSetupStatus({
		hasTenant: Boolean(tenantResult.data),
		hasMainTableConfig: Boolean(mainTableResult.data),
		folderCount,
		tableCount,
		roleCount,
		macroCount,
		obraCount,
		memberCount,
		requiresProvisioningHealth,
		firstObraProvisioningStatus,
	});

	const steps: SetupStep[] = [
		{
			id: "company",
			title: "Empresa",
			description: "Tu espacio privado ya está creado y separado de otras organizaciones.",
			ready: setupStatus.companyReady,
			href: "/profile",
			action: "Revisar mi perfil",
			icon: Building2,
		},
		{
			id: "workspace",
			title: "Modelo de trabajo",
			description: "Carpetas, certificados, compras, roles, tableros y cálculos iniciales.",
			ready: setupStatus.workspaceReady,
			href: "/admin/obra-defaults",
			action: "Revisar configuración",
			icon: FolderTree,
			available: canManageWorkspace,
		},
		{
			id: "first-obra",
			title: "Primera obra",
			description:
				obraCount > 0 && !setupStatus.firstObraReady
					? "La obra ya existe, pero todavía falta completar o verificar su estructura."
					: "Cargá la obra con la que vas a empezar a trabajar.",
			ready: setupStatus.firstObraReady,
			href: "/excel?setup=first-obra",
			action: setupStatus.firstObraReady
				? "Ver mis obras"
				: obraCount > 0
					? "Reintentar configuración"
					: "Crear mi primera obra",
			icon: HardHat,
			available: canManageWorkspace,
		},
		{
			id: "team",
			title: "Equipo (opcional)",
			description: "Invitá personas con un rol claro. Podés hacer este paso más adelante.",
			ready: setupStatus.teamReady,
			href: "/admin/users",
			action: memberCount > 1 ? "Administrar equipo" : "Invitar a alguien",
			icon: Users,
			optional: true,
			available: canManageUsers,
		},
	];
	const { completedSteps, progress } = setupStatus;
	const tenantName = tenantResult.data?.name ?? "Tu organización";

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
			<section className="overflow-hidden rounded-xl border border-stroke-soft bg-card shadow-card">
				<div className="border-b border-stroke-soft bg-surface-recessed px-5 py-4 sm:px-7">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<div className="grid size-11 place-items-center rounded-lg border border-orange-primary/25 bg-orange-primary/10 text-orange-primary shadow-sm">
								<Sparkles className="size-5" />
							</div>
							<div>
								<p className="text-sm font-medium text-content-secondary">Puesta en marcha</p>
								<h1 className="text-2xl font-semibold tracking-tight text-content">{tenantName}</h1>
							</div>
						</div>
						<Badge variant={progress === 100 ? "success" : "warning"} shape="pill" dot>
							{completedSteps} de {setupStatus.totalSteps} pasos esenciales
						</Badge>
					</div>
				</div>
				<div className="space-y-3 px-5 py-5 sm:px-7">
					<div className="flex items-end justify-between gap-4">
						<div>
							<h2 className="text-lg font-semibold text-content">Dejá todo listo sin ayuda técnica</h2>
							<p className="mt-1 max-w-2xl text-sm leading-6 text-content-secondary">
								La configuración recomendada ya resuelve la parte técnica. Solo faltan tus datos reales.
							</p>
						</div>
						<span className="text-sm font-semibold tabular-nums text-content">{progress}%</span>
					</div>
					<div className="h-3 overflow-hidden rounded-full border border-stroke-soft bg-surface-recessed shadow-inner">
						<div
							className="h-full rounded-full bg-orange-primary transition-[width] duration-300"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			</section>

			<section className="grid gap-3">
				{steps.map((step, index) => {
					const Icon = step.icon;
					return (
						<article
							key={step.id}
							className="group grid gap-4 rounded-xl border border-stroke-soft bg-card p-4 shadow-card sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5"
						>
							<div className="flex items-center gap-3 sm:block">
								<div className={`grid size-11 place-items-center rounded-lg border shadow-sm ${step.ready ? "border-success/25 bg-success/10 text-success" : "border-stroke-soft bg-surface-recessed text-content-muted"}`}>
									{step.ready ? <Check className="size-5" /> : <Icon className="size-5" />}
								</div>
								<span className="text-xs font-semibold uppercase tracking-[0.14em] text-content-muted sm:hidden">
									{step.optional ? "Opcional" : `Paso ${index + 1}`}
								</span>
							</div>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<span className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-content-muted sm:inline">
										{step.optional ? "Opcional" : `Paso ${index + 1}`}
									</span>
									{step.ready ? (
										<Badge variant="success" shape="pill">Listo</Badge>
									) : step.optional ? (
										<Badge variant="outline" shape="pill">Para después</Badge>
									) : (
										<Badge variant="outline" shape="pill" leadingIcon={<Circle className="size-2.5" />}>Pendiente</Badge>
									)}
								</div>
								<h3 className="mt-1 text-base font-semibold text-content">{step.title}</h3>
								<p className="mt-1 text-sm leading-6 text-content-secondary">{step.description}</p>
							</div>
							{step.available === false ? (
								<p className="max-w-56 text-sm leading-5 text-content-muted sm:text-right">
									Pedile ayuda a una persona administradora.
								</p>
							) : step.id === "first-obra" && !step.ready ? (
								<FirstObraDialog
									repairObra={
										firstObra
											? { id: firstObra.id, n: Number(firstObra.n) }
											: null
									}
								/>
							) : (
								<Button asChild variant={step.ready ? "outline" : "default"} className="w-full sm:w-auto">
									<Link href={step.href}>
										{step.action}
										<ArrowRight className="size-4" />
									</Link>
								</Button>
							)}
						</article>
					);
				})}
			</section>

			{progress === 100 && (
				<section className="flex flex-col gap-4 rounded-xl border border-success/25 bg-success/10 p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="font-semibold text-content">Ya podés empezar a trabajar</h2>
						<p className="mt-1 text-sm text-content-secondary">Tu espacio y tu primera obra están listos. El equipo se puede sumar cuando quieras.</p>
					</div>
					<Button asChild className="w-full sm:w-auto">
						<Link href="/excel">Ir a mis obras <ArrowRight className="size-4" /></Link>
					</Button>
				</section>
			)}
		</div>
	);
}
