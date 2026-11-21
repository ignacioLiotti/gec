import crypto from "node:crypto";
import { dirname, join, resolve } from "node:path";
import type {
	Browser,
	BrowserContext,
	BrowserContextOptions,
	TestInfo,
} from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { signInSyntheticActor } from "../helpers/auth";
import { assertLocalE2ETarget, type LocalE2ETarget } from "../helpers/local-target";
import { createLineageFixtureController } from "./lineage";
import { createDocumentGenerationFixtureController } from "./document-generation";
import { createBillingMobileFixtureController } from "./billing-mobile";
import { createAccessFixtureController } from "./access";
import { fixtureFailure, FixtureManifest } from "./manifest";
import type {
	Actor,
	ActorName,
	AnonymousContextOptions,
	NewContextOptions,
	Scenario,
} from "./types";

const permissionKeysSchema = z.array(z.string().min(1));

type ActorState = Actor & {
	storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
};

type AuthIntent = {
	email: string;
	actor: ActorName;
};

function adminClient(target: LocalE2ETarget) {
	return createClient(target.supabaseUrl.href, target.supabaseServiceRoleKey, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
	});
}

function namespaceFor(testInfo: TestInfo) {
	const run = (process.env.E2E_RUN_ID ?? crypto.randomUUID()).replaceAll("-", "");
	return `e2e-${run.slice(0, 8)}-w${testInfo.workerIndex}-r${testInfo.retry}-${crypto.randomUUID().slice(0, 8)}`;
}

function fixtureManifestPath(namespace: string) {
	const instanceManifestPath = process.env.E2E_INSTANCE_MANIFEST?.trim();
	if (!instanceManifestPath) {
		throw new Error("Isolated fixtures require E2E_INSTANCE_MANIFEST.");
	}
	return join(
		dirname(resolve(instanceManifestPath)),
		"fixture-manifests",
		`${namespace}.json`,
	);
}

function isAuthUserNotFound(error: {
	status?: number;
	code?: string;
	message: string;
}) {
	return (
		error.status === 404 &&
		(error.code === "user_not_found" || /user not found/i.test(error.message))
	);
}

function matchesAuthIntent(
	user: {
		email?: string;
		user_metadata: Record<string, unknown>;
	},
	intent: AuthIntent,
	namespace: string,
) {
	return (
		user.email === intent.email &&
		user.user_metadata.fixture_namespace === namespace &&
		user.user_metadata.fixture_actor === intent.actor
	);
}

function actorTenant(name: ActorName, tenants: { a: string; b: string }) {
	return name === "otherOwner" ? tenants.b : tenants.a;
}

function membershipRole(name: ActorName) {
	if (name === "admin") return "admin";
	return name === "owner" || name === "otherOwner" ? "owner" : "member";
}

function operationalTemplate(name: ActorName) {
	if (name === "editor" || name === "viewer") return name;
	return null;
}

function assertWrite(error: { message: string } | null, operation: string) {
	if (error) throw new Error(`${operation}: ${error.message}`);
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

class FixtureScenario implements Scenario {
	readonly namespace: string;
	readonly tenants: { a: string; b: string };
	readonly lineage: Scenario["lineage"];
	readonly permissions: Scenario["permissions"];
	readonly documentGeneration: Scenario["documentGeneration"];
	readonly billingMobile: Scenario["billingMobile"];
	readonly access: Scenario["access"];

	private readonly actors = new Map<ActorName, Promise<ActorState>>();
	private readonly contexts = new Set<BrowserContext>();
	private readonly createdTenantIds = new Set<string>();
	private readonly createdUserIds = new Set<string>();
	private readonly tenantIntents = new Map<string, string>();
	private readonly authIntents = new Map<string, AuthIntent>();
	private readonly manifest: FixtureManifest;

	constructor(
		private readonly browser: Browser,
		private readonly contextOptions: BrowserContextOptions,
		private readonly target: LocalE2ETarget,
		private readonly admin: SupabaseClient,
		namespace: string,
	) {
		this.namespace = namespace;
		this.tenants = { a: crypto.randomUUID(), b: crypto.randomUUID() };
		this.manifest = new FixtureManifest(
			namespace,
			fixtureManifestPath(namespace),
		);
		this.tenantIntents.set(this.tenants.a, `${this.namespace} tenant A`);
		this.tenantIntents.set(this.tenants.b, `${this.namespace} tenant B`);
		this.manifest.add("tenant", this.tenants.a);
		this.manifest.add("tenant", this.tenants.b);
		this.lineage = createLineageFixtureController({
			admin,
			tenantId: this.tenants.a,
			namespace,
			manifest: this.manifest,
		});
		this.permissions = {
			seedRoleConflict: (name, permissionKey) =>
				this.seedRoleConflict(name, permissionKey),
			seedUserOverride: (name, permissionKey, options) =>
				this.seedUserOverride(name, permissionKey, options),
		};
		this.documentGeneration = createDocumentGenerationFixtureController({
			admin,
			tenantId: this.tenants.a,
			namespace,
			manifest: this.manifest,
			actor: (name) => this.actor(name),
		});
		this.billingMobile = createBillingMobileFixtureController({ admin, tenantId: this.tenants.a, namespace, manifest: this.manifest });
		this.access = createAccessFixtureController({ admin, tenantId: this.tenants.a, namespace, manifest: this.manifest });
	}

	async setup() {
		const bucket = await this.admin.storage.getBucket("obra-documents");
		if (bucket.error || !bucket.data) {
			throw new Error(
				`The disposable stack lacks the obra-documents bucket: ${bucket.error?.message ?? "not found"}`,
			);
		}

		const tenantCreate = await this.admin.from("tenants").insert([
			{ id: this.tenants.a, name: `${this.namespace} tenant A` },
			{ id: this.tenants.b, name: `${this.namespace} tenant B` },
		]);
		if (tenantCreate.error) {
			const observed = await this.admin
				.from("tenants")
				.select("id, name")
				.in("id", [this.tenants.a, this.tenants.b]);
			for (const tenant of observed.data ?? []) {
				const expectedName =
					tenant.id === this.tenants.a
						? `${this.namespace} tenant A`
						: tenant.id === this.tenants.b
							? `${this.namespace} tenant B`
							: null;
				if (expectedName === tenant.name) this.createdTenantIds.add(tenant.id);
			}
		}
		assertWrite(
			tenantCreate.error,
			"Failed to create isolated E2E tenants",
		);
		this.createdTenantIds.add(this.tenants.a);
		this.createdTenantIds.add(this.tenants.b);

		await this.seedMinimalObraDefaults(this.tenants.a, "A");
		await this.seedMinimalObraDefaults(this.tenants.b, "B");
	}

	async actor(name: ActorName): Promise<Actor> {
		let pending = this.actors.get(name);
		if (!pending) {
			pending = this.createActor(name);
			this.actors.set(name, pending);
		}
		return pending;
	}

	async newAnonymousContext(options: AnonymousContextOptions = {}) {
		return this.openContext(undefined, options);
	}

	async newContext(name: ActorName, options: NewContextOptions = {}) {
		const actor = await this.actorState(name);
		const storageState = structuredClone(actor.storageState);
		const activeTenantId = options.activeTenantId ?? actor.tenantId;
		const activeTenantCookie = storageState.cookies.find(
			(cookie) => cookie.name === "active_tenant_id",
		);
		if (!activeTenantCookie) {
			throw new Error("The synthetic actor session lacks active_tenant_id.");
		}
		activeTenantCookie.value = activeTenantId;
		return this.openContext(storageState);
	}

	async cleanup() {
		const errors: string[] = [];
		const actors = await Promise.allSettled([...this.actors.values()]);
		const setupErrors = actors.flatMap((actor) => actor.status === "rejected"
			? [`actor setup failed: ${errorMessage(actor.reason)}`]
			: []);
		await this.reconcileOwnedResources(errors);

		for (const context of [...this.contexts].reverse()) {
			try {
				await context.close();
			} catch (error) {
				errors.push(`close browser context: ${errorMessage(error)}`);
			}
		}
		this.contexts.clear();

		const tenantIds = [...this.createdTenantIds];
		const obraIds = new Set(this.manifest.ids("obra"));
		if (tenantIds.length > 0) {
			const obras = await this.admin
				.from("obras")
				.select("id")
				.in("tenant_id", tenantIds);
			if (obras.error) {
				errors.push(`discover tenant obras: ${obras.error.message}`);
			} else {
				for (const obra of obras.data ?? []) {
					if (typeof obra.id === "string") {
						obraIds.add(obra.id);
						this.manifest.add("obra", obra.id);
					}
				}
			}
		}

		for (const obraId of obraIds) {
			try {
				await this.removeStorageTree(obraId);
			} catch (error) {
				errors.push(`remove storage prefix ${obraId}: ${errorMessage(error)}`);
			}
		}

		// Release current user dependencies; soft-deleted SQL remains until the runner disposes the stack.
		await this.deleteDatabaseResources({
			tenantIds,
			obraIds: [...obraIds],
			errors,
		});

		const userIds = [...this.createdUserIds];
		for (const userId of userIds) {
			const { error } = await this.admin.auth.admin.deleteUser(userId);
			if (error) errors.push(`delete auth user ${userId}: ${error.message}`);
		}
		for (const userId of userIds) {
			const residual = await this.admin.auth.admin.getUserById(userId);
			if (residual.data.user) {
				errors.push(`auth user residual: ${userId}`);
			} else if (residual.error && !isAuthUserNotFound(residual.error)) {
				errors.push(`verify auth user cleanup ${userId}: ${residual.error.message}`);
			}
		}

		if (userIds.length > 0) {
			const profileResiduals = await this.admin
				.from("profiles")
				.select("user_id")
				.in("user_id", userIds);
			if (profileResiduals.error) {
				errors.push(`verify profile cleanup: ${profileResiduals.error.message}`);
			} else if ((profileResiduals.data ?? []).length > 0) {
				errors.push(
					`profile residuals: ${(profileResiduals.data ?? []).map((row) => row.user_id).join(",")}`,
				);
			}
		}

		for (const obraId of obraIds) {
			const residual = await this.admin.storage
				.from("obra-documents")
				.list(obraId, { limit: 1 });
			if (residual.error) {
				errors.push(`verify storage prefix ${obraId}: ${residual.error.message}`);
			} else if ((residual.data ?? []).length > 0) {
				errors.push(`storage residual under ${obraId}`);
			}
		}

		if (errors.length > 0) {
			this.manifest.markCleanupFailed(errors);
			throw fixtureFailure("Isolated E2E cleanup failed", this.manifest, errors);
		}
		this.manifest.markAwaitingStackDisposal();
		if (setupErrors.length > 0) {
			throw fixtureFailure("Actor setup failed; runtime resources cleaned, SQL awaits stack disposal", this.manifest, setupErrors);
		}
	}

	private async reconcileOwnedResources(errors: string[]) {
		const tenantIds = [...this.tenantIntents.keys()];
		const tenants = await this.admin
			.from("tenants")
			.select("id, name")
			.in("id", tenantIds);
		if (tenants.error) {
			errors.push(`reconcile tenant create intents: ${tenants.error.message}`);
		} else {
			for (const tenant of tenants.data ?? []) {
				const expectedName = this.tenantIntents.get(tenant.id);
				if (expectedName === tenant.name) {
					this.createdTenantIds.add(tenant.id);
				} else {
					errors.push(`tenant create intent collided at ${tenant.id}`);
				}
			}
		}

		for (const [userId, intent] of this.authIntents) {
			const observed = await this.admin.auth.admin.getUserById(userId);
			if (observed.data.user) {
				if (matchesAuthIntent(observed.data.user, intent, this.namespace)) {
					this.createdUserIds.add(userId);
				} else {
					errors.push(`auth create intent collided at ${userId}`);
				}
			} else if (observed.error && !isAuthUserNotFound(observed.error)) {
				errors.push(`reconcile auth create intent ${userId}: ${observed.error.message}`);
			}
		}
	}

	private async selectIds(params: {
		table: string;
		column: string;
		values: string[];
		label: string;
		errors: string[];
	}) {
		if (params.values.length === 0) return [];
		const result = await this.admin
			.from(params.table)
			.select("id")
			.in(params.column, params.values);
		if (result.error) {
			params.errors.push(`${params.label}: ${result.error.message}`);
			return [];
		}
		return (result.data ?? [])
			.map((row) => row.id)
			.filter((id): id is string => typeof id === "string");
	}

	private async deleteIn(params: {
		table: string;
		column: string;
		values: string[];
		label: string;
		errors: string[];
	}) {
		if (params.values.length === 0) return;
		const result = await this.admin
			.from(params.table)
			.delete()
			.in(params.column, params.values);
		if (result.error) params.errors.push(`${params.label}: ${result.error.message}`);
	}

	private async deleteDatabaseResources(params: {
		tenantIds: string[];
		obraIds: string[];
		errors: string[];
	}) {
		const { tenantIds, obraIds, errors } = params;
		if (tenantIds.length === 0) return;
		const obraTablaIds = await this.selectIds({
			table: "obra_tablas",
			column: "obra_id",
			values: obraIds,
			label: "discover obra tables",
			errors,
		});
		const macroIds = await this.selectIds({
			table: "macro_tables",
			column: "tenant_id",
			values: tenantIds,
			label: "discover macro tables",
			errors,
		});
		const roleIds = await this.selectIds({
			table: "roles",
			column: "tenant_id",
			values: tenantIds,
			label: "discover roles",
			errors,
		});
		const defaultTablaIds = await this.selectIds({
			table: "obra_default_tablas",
			column: "tenant_id",
			values: tenantIds,
			label: "discover default tables",
			errors,
		});
		const pendienteIds = await this.selectIds({
			table: "obra_pendientes",
			column: "tenant_id",
			values: tenantIds,
			label: "discover pending tasks",
			errors,
		});
		const flujoActionIds = await this.selectIds({
			table: "obra_flujo_actions",
			column: "tenant_id",
			values: tenantIds,
			label: "discover workflow actions",
			errors,
		});

		await this.deleteIn({ table: "pendiente_schedules", column: "pendiente_id", values: pendienteIds, label: "delete pending schedules", errors });
		await this.deleteIn({ table: "obra_flujo_executions", column: "flujo_action_id", values: flujoActionIds, label: "delete workflow recipients", errors });
		await this.deleteIn({ table: "obra_document_uploads", column: "obra_id", values: obraIds, label: "delete upload ownership rows", errors });
		await this.deleteIn({ table: "ocr_document_processing", column: "obra_id", values: obraIds, label: "delete OCR processing rows", errors });
		await this.deleteIn({ table: "obra_tabla_rows", column: "tabla_id", values: obraTablaIds, label: "delete obra table rows", errors });
		await this.deleteIn({ table: "obra_tabla_columns", column: "tabla_id", values: obraTablaIds, label: "delete obra table columns", errors });
		await this.deleteIn({ table: "obra_tablas", column: "obra_id", values: obraIds, label: "delete obra tables", errors });

		await this.deleteIn({ table: "macro_table_custom_values", column: "macro_table_id", values: macroIds, label: "delete macro custom values", errors });
		await this.deleteIn({ table: "macro_table_sources", column: "macro_table_id", values: macroIds, label: "delete macro sources", errors });
		await this.deleteIn({ table: "macro_table_columns", column: "macro_table_id", values: macroIds, label: "delete macro columns", errors });
		await this.deleteIn({ table: "macro_table_permissions", column: "macro_table_id", values: macroIds, label: "delete macro permissions", errors });
		await this.deleteIn({ table: "sidebar_macro_tables", column: "role_id", values: roleIds, label: "delete sidebar macro assignments", errors });

		await this.deleteIn({ table: "generated_document_events", column: "tenant_id", values: tenantIds, label: "delete generated document events", errors });
		await this.deleteIn({ table: "generated_documents", column: "tenant_id", values: tenantIds, label: "delete generated documents", errors });
		await this.deleteIn({ table: "generated_document_drafts", column: "tenant_id", values: tenantIds, label: "delete generated document drafts", errors });
		await this.deleteIn({ table: "document_generation_templates", column: "tenant_id", values: tenantIds, label: "delete tenant document templates", errors });
		await this.deleteIn({ table: "certificates", column: "tenant_id", values: tenantIds, label: "delete certificates", errors });
		await this.deleteIn({ table: "calendar_events", column: "tenant_id", values: tenantIds, label: "delete calendar events", errors });
		await this.deleteIn({ table: "obra_pendientes", column: "tenant_id", values: tenantIds, label: "delete pending tasks", errors });
		await this.deleteIn({ table: "obra_flujo_actions", column: "tenant_id", values: tenantIds, label: "delete workflow actions", errors });
		await this.deleteIn({ table: "obra_document_deletes", column: "tenant_id", values: tenantIds, label: "delete document tombstones", errors });
		await this.deleteIn({ table: "obra_deletes", column: "tenant_id", values: tenantIds, label: "delete obra tombstones", errors });
		await this.deleteIn({ table: "obra_setup_provisioning", column: "obra_id", values: obraIds, label: "delete setup health rows", errors });
		await this.deleteIn({ table: "obras", column: "tenant_id", values: tenantIds, label: "delete obras", errors });

		await this.deleteIn({ table: "macro_tables", column: "tenant_id", values: tenantIds, label: "delete macro tables", errors });
		await this.deleteIn({ table: "obra_default_tabla_columns", column: "default_tabla_id", values: defaultTablaIds, label: "delete default table columns", errors });
		await this.deleteIn({ table: "obra_default_tablas", column: "tenant_id", values: tenantIds, label: "delete default tables", errors });
		await this.deleteIn({ table: "obra_default_quick_actions", column: "tenant_id", values: tenantIds, label: "delete default quick actions", errors });
		await this.deleteIn({ table: "obra_default_folders", column: "tenant_id", values: tenantIds, label: "delete default folders", errors });
		await this.deleteIn({ table: "ocr_templates", column: "tenant_id", values: tenantIds, label: "delete OCR templates", errors });
		await this.deleteIn({ table: "tenant_main_table_configs", column: "tenant_id", values: tenantIds, label: "delete main table configs", errors });

		await this.deleteIn({ table: "role_permissions", column: "role_id", values: roleIds, label: "delete role permissions", errors });
		await this.deleteIn({ table: "user_roles", column: "role_id", values: roleIds, label: "delete role assignments", errors });
		await this.deleteIn({ table: "roles", column: "tenant_id", values: tenantIds, label: "delete roles", errors });
		await this.deleteIn({ table: "memberships", column: "tenant_id", values: tenantIds, label: "delete memberships", errors });
		await this.deleteIn({ table: "audit_log", column: "tenant_id", values: tenantIds, label: "delete fixture audit records", errors });
	}

	private async actorState(name: ActorName) {
		await this.actor(name);
		const actor = await this.actors.get(name);
		if (!actor) throw new Error(`Actor ${name} was not registered.`);
		return actor;
	}

	private async createActor(name: ActorName): Promise<ActorState> {
		const tenantId = actorTenant(name, this.tenants);
		const userId = crypto.randomUUID();
		const password = crypto.randomBytes(32).toString("base64url");
		const email = `${name}.${this.namespace}@e2e.invalid`.toLowerCase();
		const intent = { email, actor: name } satisfies AuthIntent;
		this.authIntents.set(userId, intent);
		this.manifest.add("auth-user", userId);

		const created = await this.admin.auth.admin.createUser({
			id: userId,
			email,
			password,
			email_confirm: true,
			user_metadata: { fixture_namespace: this.namespace, fixture_actor: name },
		});
		if (created.error || !created.data.user) {
			const observed = await this.admin.auth.admin.getUserById(userId);
			if (
				observed.data.user &&
				matchesAuthIntent(observed.data.user, intent, this.namespace)
			) {
				this.createdUserIds.add(userId);
			}
			throw new Error(
				`Failed to create the ${name} E2E actor: ${created.error?.message ?? "user missing"}`,
			);
		}
		if (created.data.user.id !== userId) {
			throw new Error(`Auth returned an unexpected user ID for the ${name} E2E actor.`);
		}
		if (!matchesAuthIntent(created.data.user, intent, this.namespace)) {
			throw new Error(`Auth returned unexpected ownership metadata for the ${name} E2E actor.`);
		}
		this.createdUserIds.add(userId);

		this.manifest.add("membership", `${tenantId}:${userId}`);
		assertWrite(
			(
				await this.admin.from("memberships").insert({
					tenant_id: tenantId,
					user_id: userId,
					role: membershipRole(name),
				})
			).error,
			`Failed to create the ${name} membership`,
		);

		const templateKey = operationalTemplate(name);
		if (templateKey) {
			await this.assignOperationalRole({ name, tenantId, userId, templateKey });
		}

		const authenticated = await signInSyntheticActor({
			target: this.target,
			email,
			password,
			activeTenantId: tenantId,
		});
		const context = await this.openContext(authenticated.storageState);
		return {
			userId,
			tenantId,
			context,
			request: context.request,
			db: authenticated.db,
			storageState: await context.storageState(),
		};
	}

	private async assignOperationalRole(params: {
		name: ActorName;
		tenantId: string;
		userId: string;
		templateKey: "editor" | "viewer";
	}) {
		const roleId = crypto.randomUUID();
		this.manifest.add("role", roleId);
		assertWrite(
			(
				await this.admin.from("roles").insert({
					id: roleId,
					tenant_id: params.tenantId,
					key: `${this.namespace}-${params.name}`,
					name: `E2E ${params.name}`,
					description: `Synthetic ${params.name} role`,
					is_default: false,
				})
			).error,
			`Failed to create the ${params.name} operational role`,
		);
		const template = await this.admin
			.from("role_templates")
			.select("permissions")
			.eq("key", params.templateKey)
			.single();
		if (template.error || !template.data) {
			throw new Error(
				`Failed to resolve the ${params.templateKey} role template: ${template.error?.message ?? "missing"}`,
			);
		}
		const permissions = permissionKeysSchema.parse(template.data.permissions);
		const permissionRows = await this.admin
			.from("permissions")
			.select("id, key")
			.in("key", permissions);
		if (permissionRows.error) {
			throw new Error(
				`Failed to resolve ${params.name} permissions: ${permissionRows.error.message}`,
			);
		}
		const foundKeys = new Set((permissionRows.data ?? []).map((row) => row.key));
		const missing = permissions.filter((key) => !foundKeys.has(key));
		if (missing.length > 0) {
			throw new Error(`Missing operational permissions: ${missing.join(", ")}`);
		}
		for (const permission of permissionRows.data ?? []) {
			this.manifest.add("role-permission", `${roleId}:${permission.id}`);
		}
		assertWrite(
			(
				await this.admin.from("role_permissions").insert(
					(permissionRows.data ?? []).map((permission) => ({
						role_id: roleId,
						permission_id: permission.id,
						is_granted: true,
					})),
				)
			).error,
			`Failed to grant ${params.name} permissions`,
		);
		this.manifest.add("user-role", `${params.userId}:${roleId}`);
		assertWrite(
			(
				await this.admin.from("user_roles").insert({
					user_id: params.userId,
					role_id: roleId,
				})
			).error,
			`Failed to assign the ${params.name} operational role`,
		);
	}

	private async seedRoleConflict(name: ActorName, permissionKey: string) {
		const actor = await this.actorState(name);
		const permission = await this.admin
			.from("permissions")
			.select("id")
			.eq("key", permissionKey)
			.single();
		if (permission.error || !permission.data) {
			throw new Error(
				`Failed to resolve conflict permission ${permissionKey}: ${permission.error?.message ?? "missing"}`,
			);
		}
		const grantRoleId = crypto.randomUUID();
		const denyRoleId = crypto.randomUUID();
		this.manifest.add("role", grantRoleId);
		this.manifest.add("role", denyRoleId);
		this.manifest.add(
			"role-permission",
			`${grantRoleId}:${permission.data.id}`,
		);
		this.manifest.add(
			"role-permission",
			`${denyRoleId}:${permission.data.id}`,
		);
		assertWrite(
			(
				await this.admin.from("roles").insert([
					{
						id: grantRoleId,
						tenant_id: actor.tenantId,
						key: `${this.namespace}-grant-${grantRoleId.slice(0, 8)}`,
						name: "E2E grant conflict role",
						is_default: false,
					},
					{
						id: denyRoleId,
						tenant_id: actor.tenantId,
						key: `${this.namespace}-deny-${denyRoleId.slice(0, 8)}`,
						name: "E2E deny conflict role",
						is_default: false,
					},
				])
			).error,
			"Failed to create conflicting roles",
		);
		this.manifest.add("user-role", `${actor.userId}:${grantRoleId}`);
		this.manifest.add("user-role", `${actor.userId}:${denyRoleId}`);
		assertWrite(
			(
				await this.admin.from("role_permissions").insert([
					{
						role_id: grantRoleId,
						permission_id: permission.data.id,
						is_granted: true,
					},
					{
						role_id: denyRoleId,
						permission_id: permission.data.id,
						is_granted: false,
					},
				])
			).error,
			"Failed to create conflicting role grants",
		);
		assertWrite(
			(
				await this.admin.from("user_roles").insert([
					{ user_id: actor.userId, role_id: grantRoleId },
					{ user_id: actor.userId, role_id: denyRoleId },
				])
			).error,
			"Failed to assign conflicting roles",
		);
		return { grantRoleId, denyRoleId };
	}

	private async seedUserOverride(
		name: ActorName,
		permissionKey: string,
		options: {
			tenant: keyof Scenario["tenants"];
			decision: "grant" | "deny";
		},
	) {
		const actor = await this.actorState(name);
		const tenantId = this.tenants[options.tenant];
		if (tenantId !== actor.tenantId) {
			this.manifest.add("membership", `${tenantId}:${actor.userId}`);
			const membership = await this.admin
				.from("memberships")
				.select("user_id")
				.eq("tenant_id", tenantId)
				.eq("user_id", actor.userId)
				.maybeSingle();
			assertWrite(
				membership.error,
				`Failed to inspect ${name} membership in tenant ${options.tenant}`,
			);
			if (!membership.data) {
				assertWrite(
					(
						await this.admin.from("memberships").insert({
							tenant_id: tenantId,
							user_id: actor.userId,
							role: "member",
						})
					).error,
					`Failed to add ${name} to tenant ${options.tenant}`,
				);
			}
		}

		const permission = await this.admin
			.from("permissions")
			.select("id")
			.eq("key", permissionKey)
			.single();
		if (permission.error || !permission.data) {
			throw new Error(
				`Failed to resolve user override permission ${permissionKey}: ${permission.error?.message ?? "missing"}`,
			);
		}
		assertWrite(
			(
				await this.admin
					.from("user_permission_overrides")
					.upsert(
						{
							user_id: actor.userId,
							tenant_id: tenantId,
							permission_id: permission.data.id,
							is_granted: options.decision === "grant",
						},
						{ onConflict: "user_id,tenant_id,permission_id" },
					)
			).error,
			`Failed to create the ${name} ${options.decision} override`,
		);
		return { tenantId, permissionId: permission.data.id };
	}

	private async seedMinimalObraDefaults(tenantId: string, suffix: string) {
		const folderId = crypto.randomUUID();
		const tablaId = crypto.randomUUID();
		const columnIds = [crypto.randomUUID(), crypto.randomUUID()];
		this.manifest.add("default-folder", folderId);
		this.manifest.add("default-tabla", tablaId);
		columnIds.forEach((id) => this.manifest.add("default-tabla-column", id));
		assertWrite(
			(
				await this.admin.from("obra_default_folders").insert({
					id: folderId,
					tenant_id: tenantId,
					name: "Documentos E2E",
					path: "documentos-e2e",
					position: 0,
				})
			).error,
			`Failed to create tenant ${suffix} default folder`,
		);
		assertWrite(
			(
				await this.admin.from("obra_default_tablas").insert({
					id: tablaId,
					tenant_id: tenantId,
					name: "Documentos E2E",
					description: "Minimal valid OCR default for isolated tests",
					source_type: "ocr",
					linked_folder_path: "documentos-e2e",
					settings: {
						dataInputMethod: "both",
						manualEntryEnabled: true,
						documentTypes: ["documento"],
						extractionRowMode: "multiple",
					},
					position: 0,
				})
			).error,
			`Failed to create tenant ${suffix} default OCR table`,
		);
		assertWrite(
			(
				await this.admin.from("obra_default_tabla_columns").insert([
					{
						id: columnIds[0],
						default_tabla_id: tablaId,
						field_key: "item_code",
						label: "Item",
						data_type: "text",
						position: 0,
						required: true,
						config: { lineageKey: true, ocrScope: "item" },
					},
					{
						id: columnIds[1],
						default_tabla_id: tablaId,
						field_key: "amount",
						label: "Importe",
						data_type: "number",
						position: 1,
						required: false,
						config: { ocrScope: "item" },
					},
				])
			).error,
			`Failed to create tenant ${suffix} default OCR columns`,
		);
	}

	private async openContext(
		storageState: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined,
		options: AnonymousContextOptions = {},
	) {
		const context = await this.browser.newContext({
			...this.contextOptions,
			...options,
			extraHTTPHeaders: { ...this.contextOptions.extraHTTPHeaders, Connection: "close" },
			baseURL: this.target.appUrl.href,
			serviceWorkers: "block",
			storageState,
		});
		this.contexts.add(context);
		const appSocketOrigin = this.target.appUrl.origin.replace(/^http/, "ws");
		let initialHash: string | null = null;
		await context.routeWebSocket(
			(url) => url.origin === appSocketOrigin && url.pathname === "/_next/webpack-hmr",
			(socket) => {
				const server = socket.connectToServer();
				server.onMessage((message) => {
					if (typeof message === "string") {
						try {
							const payload: unknown = JSON.parse(message);
							const sync = z.object({ type: z.literal("sync"), hash: z.string() }).passthrough().safeParse(payload);
							if (sync.success) {
								// Cold compilation must not look like a restart of this immutable snapshot.
								initialHash ??= sync.data.hash;
								socket.send(JSON.stringify({ ...sync.data, hash: initialHash }));
								return;
							}
						} catch {
							// Preserve development messages outside the JSON SYNC protocol.
						}
					}
					socket.send(message);
				});
			},
		);
		await context.route("**/*", async (route) => {
			const url = new URL(route.request().url());
			if (
				url.protocol === "data:" ||
				url.protocol === "blob:" ||
				url.origin === this.target.appUrl.origin ||
				url.origin === this.target.supabaseUrl.origin
			) {
				await route.continue();
				return;
			}
			await route.abort("blockedbyclient");
		});
		return context;
	}

	private async removeStorageTree(prefix: string) {
		const files: string[] = [];
		const visit = async (path: string): Promise<void> => {
			let offset = 0;
			while (true) {
				const listed = await this.admin.storage
					.from("obra-documents")
					.list(path, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
				if (listed.error) throw listed.error;
				const entries = listed.data ?? [];
				for (const entry of entries) {
					const entryPath = `${path}/${entry.name}`;
					if (entry.id) {
						files.push(entryPath);
						this.manifest.add("storage-object", entryPath);
					} else {
						await visit(entryPath);
					}
				}
				if (entries.length < 100) break;
				offset += entries.length;
			}
		};
		await visit(prefix);
		for (let index = 0; index < files.length; index += 100) {
			const removed = await this.admin.storage
				.from("obra-documents")
				.remove(files.slice(index, index + 100));
			if (removed.error) throw removed.error;
		}
	}
}

export async function createScenario(params: {
	browser: Browser;
	contextOptions: BrowserContextOptions;
	testInfo: TestInfo;
}) {
	const target = assertLocalE2ETarget({ kind: "execution", env: process.env });
	const scenario = new FixtureScenario(
		params.browser,
		params.contextOptions,
		target,
		adminClient(target),
		namespaceFor(params.testInfo),
	);
	try {
		await scenario.setup();
		return scenario;
	} catch (setupError) {
		try {
			await scenario.cleanup();
		} catch (cleanupError) {
			throw new AggregateError(
				[setupError, cleanupError],
				"Isolated E2E scenario setup and rollback both failed.",
			);
		}
		throw setupError;
	}
}

export async function cleanupScenario(scenario: FixtureScenario) {
	await scenario.cleanup();
}
