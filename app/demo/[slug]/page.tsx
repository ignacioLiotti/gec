import { notFound } from "next/navigation";

import { DemoEntryClient } from "./demo-entry-client";
import {
	getDemoLinkBySlug,
	resolveDemoSessionFromCookies,
} from "@/lib/demo-session";
import { getDemoLaunchPath, getTenantDemoExperienceSettings } from "@/lib/demo-flows/runtime";

type DemoPageProps = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ token?: string; error?: string }>;
};

const errorCopy: Record<string, string> = {
	"missing-token": "Falta el token de acceso para esta demo.",
	"not-found": "No encontramos esta demo.",
	"invalid-token": "El token de acceso no es valido.",
	revoked: "Esta demo fue revocada.",
	expired: "Esta demo ya expiro.",
};

export default async function DemoPage({
	params,
	searchParams,
}: DemoPageProps) {
	const { slug } = await params;
	const { token, error } = await searchParams;

	const [demoLink, activeSession] = await Promise.all([
		getDemoLinkBySlug(slug),
		resolveDemoSessionFromCookies(),
	]);

	if (!demoLink) {
		notFound();
	}

	const tenantName = Array.isArray(demoLink.tenants)
		? (demoLink.tenants[0]?.name ?? "Organizacion demo")
		: (demoLink.tenants?.name ?? "Organizacion demo");
	const hasActiveSession =
		activeSession?.slug === slug && activeSession.tenantId === demoLink.tenant_id;
	const demoSettings = await getTenantDemoExperienceSettings(demoLink.tenant_id);
	const continuePath = await getDemoLaunchPath(slug, demoLink.tenant_id);

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed,transparent_30%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] px-6 py-16 text-stone-900">
			<div className="mx-auto flex max-w-3xl flex-col gap-8">
				<div className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
					Sintesis Demo
				</div>

				<div className="space-y-4 rounded-[28px] border border-stone-200 bg-white p-8 shadow-[0_30px_80px_rgba(28,25,23,0.08)]">
					<div className="space-y-2">
						<h1 className="text-3xl font-semibold tracking-tight text-stone-950">
							{demoSettings.headline ?? demoLink.label ?? `Demo para ${tenantName}`}
						</h1>
						<p className="max-w-2xl text-sm leading-6 text-stone-600">
							{demoSettings.subheadline ??
								"Esta demo usa una organizacion real de prueba, con configuracion y datos preparados para mostrar flujos especificos sin login."}
						</p>
					</div>

					<div className="grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600 sm:grid-cols-2">
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-stone-400">
								Organizacion
							</p>
							<p className="mt-1 font-medium text-stone-900">{tenantName}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-[0.18em] text-stone-400">
								Acceso
							</p>
							<p className="mt-1 font-medium text-stone-900">
								Sesion compartida de navegador
							</p>
						</div>
					</div>

					{error ? (
						<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{errorCopy[error] ?? "No se pudo abrir la demo."}
						</div>
					) : null}

					<DemoEntryClient
						slug={slug}
						token={typeof token === "string" ? token : null}
						hasActiveSession={hasActiveSession}
						continuePath={continuePath}
					/>
				</div>
			</div>
		</div>
	);
}
