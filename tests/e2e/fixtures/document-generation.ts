import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FixtureManifest } from "./manifest";
import type { Actor, ActorName, Scenario } from "./types";

const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sW7xS0AAAAASUVORK5CYII=";

function assertWrite(error: { message: string } | null, operation: string) {
	if (error) throw new Error(`${operation}: ${error.message}`);
}

export function createDocumentGenerationFixtureController({
	admin, tenantId, namespace, manifest, actor,
}: {
	admin: SupabaseClient;
	tenantId: string;
	namespace: string;
	manifest: FixtureManifest;
	actor(name: ActorName): Promise<Actor>;
}): Scenario["documentGeneration"] {
	return {
		async createLifecycleSeed(label) {
			const obraId = crypto.randomUUID();
			const tablaId = crypto.randomUUID();
			const templateId = crypto.randomUUID();
			const columnId = crypto.randomUUID();
			const folderPath = `${namespace}-lifecycle-${crypto.randomUUID().slice(0, 8)}`;
			const obraName = `[E2E][${namespace}] ${label}`;
			manifest.add("obra", obraId);
			manifest.add("tabla", tablaId);
			manifest.add("tabla-column", columnId);
			manifest.add("document-template", templateId);
			assertWrite((await admin.from("obras").insert({
				id: obraId, tenant_id: tenantId, n: crypto.randomInt(1_000_000, 9_999_999),
				designacion_y_ubicacion: obraName, entidad_contratante: "Synthetic document lifecycle",
				mes_basico_de_contrato: "01/01/2026", iniciacion: "15/01/2026",
			})).error, "Create lifecycle obra precondition");
			assertWrite((await admin.from("obra_tablas").insert({
				id: tablaId, obra_id: obraId, name: `Lifecycle ${label}`, source_type: "ocr",
				settings: { ocrFolder: folderPath, dataInputMethod: "both", manualEntryEnabled: true, documentTypes: ["ACT"] },
			})).error, "Create materialized lifecycle extraction target");
			assertWrite((await admin.from("obra_tabla_columns").insert({
				id: columnId, tabla_id: tablaId, field_key: "lifecycle_note", label: "Lifecycle note",
				data_type: "text", position: 0, required: true, config: { ocrScope: "item" },
			})).error, "Create lifecycle target column");
			assertWrite((await admin.from("document_generation_templates").insert({
				id: templateId, tenant_id: tenantId, key: `${namespace}-${templateId}`, name: `Lifecycle ${label}`,
				document_type: "ACT", target_folder_path: folderPath, version: 1, status: "active", is_system: false,
				schema: { fields: [{ key: "lifecycle_note", label: "Lifecycle note", type: "text", required: true, source: "extra" }], fileNamePattern: "lifecycle-{{lifecycle_note}}.pdf" },
				content_html: "<article><h1>Lifecycle {{lifecycle_note}}</h1><p>Durable renderer proof</p></article>",
			})).error, "Create lifecycle template precondition");
			return { obraId, obraName, tablaId, folderPath, documentType: "ACT", templateId };
		},
		async setActorSignature(name) {
			const user = await actor(name);
			const result = await admin.from("profiles").update({
				digital_signature_data_url: signature, full_name: `E2E ${name} reviewer`,
			}).eq("user_id", user.userId).select("user_id").single();
			assertWrite(result.error, "Set synthetic reviewer signature");
			if (!result.data) throw new Error("Reviewer profile was not updated.");
		},
	};
}
