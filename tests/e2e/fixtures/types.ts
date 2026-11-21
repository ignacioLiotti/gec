import type {
	APIRequestContext,
	BrowserContext,
	BrowserContextOptions,
} from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { createBillingMobileFixtureController } from "./billing-mobile";
import type { createAccessFixtureController } from "./access";

import type {
	LineageFixture,
	OcrMultiLineageFixture,
	SpreadsheetLineageFixture,
} from "../helpers/lineage";

export type ActorName =
	| "owner"
	| "admin"
	| "editor"
	| "viewer"
	| "otherOwner";

export type ScenarioTenant = "a" | "b";

export type Actor = {
	userId: string;
	tenantId: string;
	context: BrowserContext;
	request: APIRequestContext;
	db: SupabaseClient;
};

export type NewContextOptions = {
	activeTenantId?: string;
};

export type AnonymousContextOptions = Pick<BrowserContextOptions, "viewport" | "isMobile" | "hasTouch">;

export type DocumentLifecycleSeed = {
	obraId: string;
	obraName: string;
	tablaId: string;
	folderPath: string;
	documentType: "ACT";
	templateId: string;
};

export type Scenario = {
	namespace: string;
	tenants: {
		a: string;
		b: string;
	};
	actor(name: ActorName): Promise<Actor>;
	newContext(
		name: ActorName,
		options?: NewContextOptions,
	): Promise<BrowserContext>;
	newAnonymousContext(options?: AnonymousContextOptions): Promise<BrowserContext>;
	billingMobile: ReturnType<typeof createBillingMobileFixtureController>;
	access: ReturnType<typeof createAccessFixtureController>;
	documentGeneration: {
		createLifecycleSeed(label: string): Promise<DocumentLifecycleSeed>;
		setActorSignature(name: ActorName): Promise<void>;
	};
	lineage: {
		createSingle(label: string): Promise<LineageFixture>;
		createOcrMulti(label: string): Promise<OcrMultiLineageFixture>;
		createSpreadsheet(label: string): Promise<SpreadsheetLineageFixture>;
		injectLegacyConflict(
			fixture: LineageFixture,
			args: { lineageRowKey: string; value: unknown },
		): Promise<string>;
	};
	permissions: {
		seedRoleConflict(
			name: ActorName,
			permissionKey: string,
		): Promise<{ grantRoleId: string; denyRoleId: string }>;
		seedUserOverride(
			name: ActorName,
			permissionKey: string,
			options: {
				tenant: ScenarioTenant;
				decision: "grant" | "deny";
			},
		): Promise<{ tenantId: string; permissionId: string }>;
	};
};
