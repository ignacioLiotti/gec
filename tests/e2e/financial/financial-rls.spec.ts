import { randomUUID } from "node:crypto";
import { createObraViaBulkApi } from "../helpers/obras";
import { expect, test } from "../fixtures/test";
import {
	buildInsurancePolicyWorkbook,
	confirmInsuranceImport,
	createCertificate,
	findInsurancePolicy,
	listObraCertificates,
	previewInsuranceImport,
} from "./financial-workflows";

function expectDeniedMutation(
	result: { data: unknown; error: { code?: string } | null },
	message: string,
) {
	if (result.error) {
		expect.soft(result.error.code, `${message}: database error must be the RLS denial`).toBe("42501");
		return;
	}
	expect.soft(result.data, `${message}: a filtered mutation must return exactly zero rows`).toEqual([]);
}

test("financial permissions govern direct insert, update, and delete with owner positive controls", async ({ scenario }) => {
	const owner = await scenario.actor("owner");
	const viewer = await scenario.actor("viewer");
	const editor = await scenario.actor("editor");
	const obraName = `${scenario.namespace} RLS financiero`;
	const obra = await createObraViaBulkApi(owner.request, {
		designacionYUbicacion: obraName,
	});
	const certificate = await createCertificate(owner.request, obra.id, {
		nExp: `${scenario.namespace}-RLS-CERT`,
		nCertificate: 1,
		amount: 25_000,
		month: "2026-10",
	});
	const policyNumber = `${scenario.namespace}-RLS-POL`;
	const workbook = buildInsurancePolicyWorkbook([{ policyNumber, obra: obraName }]);
	const preview = await previewInsuranceImport(
		owner.request,
		workbook,
		`${scenario.namespace}-rls.xlsx`,
	);
	await confirmInsuranceImport(owner.request, preview.preview);
	const policy = await findInsurancePolicy(owner.request, policyNumber);

	await scenario.permissions.seedUserOverride("viewer", "certificados:edit", {
		tenant: "a",
		decision: "deny",
	});
	await scenario.permissions.seedUserOverride("viewer", "insurance-policies:manage", {
		tenant: "a",
		decision: "deny",
	});
	await scenario.permissions.seedUserOverride("viewer", "certificados:admin", {
		tenant: "a",
		decision: "deny",
	});

	const deniedCertificateId = randomUUID();
	const deniedPolicyId = randomUUID();
	const certificateInsert = await viewer.db.from("certificates").insert({
		id: deniedCertificateId,
		tenant_id: owner.tenantId,
		obra_id: obra.id,
		n_exp: `${scenario.namespace}-DIRECT-DENIED`,
		n_certificado: 2,
		monto: 125,
		mes: "2026-10",
	}).select("id");
	expectDeniedMutation(certificateInsert, "certificate insert requires certificados:edit");
	const policyInsert = await viewer.db.from("insurance_policies").insert({
		id: deniedPolicyId,
		tenant_id: owner.tenantId,
		obra_id: obra.id,
		policy_number: `${scenario.namespace}-DIRECT-DENIED`,
	}).select("id");
	expectDeniedMutation(policyInsert, "policy insert requires insurance-policies:manage");
	for (const [table, id] of [["certificates", deniedCertificateId], ["insurance_policies", deniedPolicyId]]) {
		const absent = await owner.db.from(table).select("id").eq("id", id);
		expect.soft(absent.error).toBeNull();
		expect.soft(absent.data).toEqual([]);
	}

	const certificateUpdate = await viewer.db
		.from("certificates")
		.update({ concepto: "escritura directa denegada" })
		.eq("id", certificate.id)
		.select("id, concepto");
	expectDeniedMutation(
		certificateUpdate,
		"certificados:edit deny must block the direct update",
	);

	const policyUpdate = await viewer.db
		.from("insurance_policies")
		.update({ cancellation_notes: "escritura directa denegada" })
		.eq("id", policy.id)
		.select("id, cancellation_notes");
	expectDeniedMutation(
		policyUpdate,
		"insurance-policies:manage deny must block the direct update",
	);
	const certificateDelete = await viewer.db.from("certificates").delete().eq("id", certificate.id).select("id");
	expectDeniedMutation(certificateDelete, "certificate delete requires certificados:admin");
	const policyDelete = await viewer.db.from("insurance_policies").delete().eq("id", policy.id).select("id");
	expectDeniedMutation(policyDelete, "policy delete requires insurance-policies:manage");

	const certificateReadback = await listObraCertificates(owner.request, obra.id);
	expect.soft(certificateReadback.certificates[0]?.concepto).toBeNull();
	const policyReadback = await findInsurancePolicy(owner.request, policyNumber);
	expect.soft(policyReadback.cancellation_notes).toBeNull();

	const ownerCertificateUpdate = await owner.db
		.from("certificates")
		.update({ concepto: "control directo del owner" })
		.eq("id", certificate.id)
		.select("id, concepto")
		.single();
	expect.soft(ownerCertificateUpdate.error).toBeNull();
	expect.soft(ownerCertificateUpdate.data).toEqual({
		id: certificate.id,
		concepto: "control directo del owner",
	});

	const ownerPolicyUpdate = await owner.db
		.from("insurance_policies")
		.update({ cancellation_notes: "control directo del owner" })
		.eq("id", policy.id)
		.select("id, cancellation_notes")
		.single();
	expect.soft(ownerPolicyUpdate.error).toBeNull();
	expect.soft(ownerPolicyUpdate.data).toEqual({
		id: policy.id,
		cancellation_notes: "control directo del owner",
	});

	const certificateControlReadback = await listObraCertificates(owner.request, obra.id);
	expect.soft(certificateControlReadback.certificates[0]?.concepto).toBe("control directo del owner");
	const policyControlReadback = await findInsurancePolicy(owner.request, policyNumber);
	expect.soft(policyControlReadback.cancellation_notes).toBe("control directo del owner");

	const ownerCertificateId = randomUUID();
	const ownerPolicyId = randomUUID();
	const positiveCertificate = await owner.db.from("certificates").insert({
		id: ownerCertificateId,
		tenant_id: owner.tenantId,
		obra_id: obra.id,
		n_exp: `${scenario.namespace}-DIRECT-OWNER`,
		n_certificado: 3,
		monto: 250,
		mes: "2026-10",
	}).select("id").single();
	expect(positiveCertificate.error).toBeNull();
	expect(positiveCertificate.data).toEqual({ id: ownerCertificateId });
	const positivePolicy = await owner.db.from("insurance_policies").insert({
		id: ownerPolicyId,
		tenant_id: owner.tenantId,
		obra_id: obra.id,
		policy_number: `${scenario.namespace}-DIRECT-OWNER`,
	}).select("id").single();
	expect(positivePolicy.error).toBeNull();
	expect(positivePolicy.data).toEqual({ id: ownerPolicyId });
	const deleteCertificateControl = await owner.db.from("certificates").delete().eq("id", ownerCertificateId);
	expect(deleteCertificateControl.error).toBeNull();
	const deletePolicyControl = await owner.db.from("insurance_policies").delete().eq("id", ownerPolicyId);
	expect(deletePolicyControl.error).toBeNull();
	const remainingCertificates = await listObraCertificates(owner.request, obra.id);
	expect(remainingCertificates.certificates.map(row => row.id)).toEqual([certificate.id]);
	const remainingPolicy = await owner.db.from("insurance_policies").select("id").eq("id", ownerPolicyId);
	expect(remainingPolicy.error).toBeNull();
	expect(remainingPolicy.data).toEqual([]);

	await scenario.permissions.seedUserOverride("editor", "certificados:edit", { tenant: "a", decision: "grant" });
	await scenario.permissions.seedUserOverride("editor", "certificados:admin", { tenant: "a", decision: "deny" });
	const editorCertificateId = randomUUID();
	const editorInsert = await editor.db.from("certificates").insert({
		id: editorCertificateId,
		tenant_id: owner.tenantId,
		obra_id: obra.id,
		n_exp: `${scenario.namespace}-DIRECT-EDITOR`,
		n_certificado: 4,
		monto: 500,
		mes: "2026-10",
	}).select("id").single();
	expect(editorInsert.error).toBeNull();
	expect(editorInsert.data).toEqual({ id: editorCertificateId });
	const editorUpdate = await editor.db.from("certificates").update({ concepto: "edit allowed without admin" })
		.eq("id", editorCertificateId).select("concepto").single();
	expect(editorUpdate.error).toBeNull();
	expect(editorUpdate.data).toEqual({ concepto: "edit allowed without admin" });
	const editorDelete = await editor.db.from("certificates").delete().eq("id", editorCertificateId).select("id");
	expectDeniedMutation(editorDelete, "certificados:edit cannot substitute for certificados:admin");
	expect((await listObraCertificates(owner.request, obra.id)).certificates.map(row => row.id))
		.toContain(editorCertificateId);

	await scenario.permissions.seedUserOverride("viewer", "certificados:admin", { tenant: "a", decision: "grant" });
	const adminOnlyPermissions = await Promise.all([
		viewer.db.rpc("has_permission", { tenant: owner.tenantId, perm_key: "certificados:edit" }),
		viewer.db.rpc("has_permission", { tenant: owner.tenantId, perm_key: "certificados:admin" }),
	]);
	expect(adminOnlyPermissions.map(result => result.error)).toEqual([null, null]);
	expect(adminOnlyPermissions.map(result => result.data)).toEqual([false, true]);
	const adminOnlyUpdate = await viewer.db.from("certificates").update({ concepto: "admin cannot edit" })
		.eq("id", editorCertificateId).select("id");
	expectDeniedMutation(adminOnlyUpdate, "certificados:admin cannot substitute for certificados:edit");
	const adminOnlyInsertId = randomUUID();
	const adminOnlyInsert = await viewer.db.from("certificates").insert({
		id: adminOnlyInsertId,
		tenant_id: owner.tenantId,
		obra_id: obra.id,
		n_exp: `${scenario.namespace}-DIRECT-ADMIN-INSERT`,
		n_certificado: 5,
		monto: 750,
		mes: "2026-10",
	}).select("id");
	expectDeniedMutation(adminOnlyInsert, "admin-only certificate permission does not allow insert");
	const adminOnlyInsertReadback = await owner.db.from("certificates").select("id").eq("id", adminOnlyInsertId);
	expect(adminOnlyInsertReadback.error).toBeNull();
	expect(adminOnlyInsertReadback.data).toEqual([]);
	const stillUnchanged = await owner.db.from("certificates").select("concepto").eq("id", editorCertificateId).single();
	expect(stillUnchanged.error).toBeNull();
	expect(stillUnchanged.data).toEqual({ concepto: "edit allowed without admin" });
	const adminOnlyDelete = await viewer.db.from("certificates").delete().eq("id", editorCertificateId);
	expect(adminOnlyDelete.error).toBeNull();
	expect((await listObraCertificates(owner.request, obra.id)).certificates.map(row => row.id))
		.not.toContain(editorCertificateId);
});
