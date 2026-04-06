"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

const SUPERADMIN_USER_ID = "77b936fb-3e92-4180-b601-15c31125811e";

function slugify(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function buildBaseUrl() {
	return (
		process.env.NEXT_PUBLIC_APP_URL ??
		(process.env.NEXT_PUBLIC_VERCEL_URL
			? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
			: process.env.VERCEL_URL
				? `https://${process.env.VERCEL_URL}`
				: "http://localhost:3000")
	);
}

async function assertTenantAdminAccess(tenantId: string) {
	const supabase = await createClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		throw new Error("Unauthorized");
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("is_superadmin")
		.eq("user_id", user.id)
		.maybeSingle();

	const isSuperAdmin =
		(profile?.is_superadmin ?? false) || user.id === SUPERADMIN_USER_ID;

	if (!isSuperAdmin) {
		const { data: membership } = await supabase
			.from("memberships")
			.select("role")
			.eq("tenant_id", tenantId)
			.eq("user_id", user.id)
			.maybeSingle();

		const isAdmin =
			membership?.role === "owner" || membership?.role === "admin";
		if (!isAdmin) {
			throw new Error("No tenes permisos para gestionar demos de esta organizacion.");
		}
	}

	return { user, isSuperAdmin };
}

export async function createDemoLinkAction(input: {
	tenantId: string;
	tenantName: string;
	label?: string;
	slug?: string;
	expiresInDays?: number | null;
	capabilities?: string[];
}) {
	const tenantId = String(input.tenantId ?? "").trim();
	if (!tenantId) {
		return { error: "Selecciona una organizacion valida." };
	}

	try {
		const { user } = await assertTenantAdminAccess(tenantId);
		const admin = createSupabaseAdminClient();
		const token = randomBytes(24).toString("base64url");
		const tokenHash = createHash("sha256").update(token).digest("hex");
		const baseSlug = slugify(input.slug?.trim() || input.label?.trim() || input.tenantName);
		const slug = `${baseSlug || "demo"}-${randomBytes(3).toString("hex")}`;
		const expiresInDays =
			typeof input.expiresInDays === "number" && Number.isFinite(input.expiresInDays)
				? Math.max(1, Math.min(90, Math.round(input.expiresInDays)))
				: null;
		const expiresAt = expiresInDays
			? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
			: null;
		const capabilities =
			Array.isArray(input.capabilities) && input.capabilities.length > 0
				? input.capabilities
				: ["dashboard", "excel"];

		const { data: createdLink, error } = await admin
			.from("tenant_demo_links")
			.insert({
				tenant_id: tenantId,
				slug,
				label: input.label?.trim() || `Demo ${input.tenantName}`,
				token_hash: tokenHash,
				allowed_capabilities: capabilities,
				expires_at: expiresAt,
				created_by: user.id,
			})
			.select("id, slug, label, expires_at, allowed_capabilities")
			.single();

		if (error) {
			console.error("[demo-links] create failed", error);
			return { error: error.message || "No se pudo crear el demo link." };
		}

		revalidatePath("/admin/demo-links");

		return {
			success: true,
			id: createdLink.id,
			token,
			slug: createdLink.slug,
			label: createdLink.label,
			expiresAt: createdLink.expires_at,
			allowedCapabilities: createdLink.allowed_capabilities,
			url: `${buildBaseUrl()}/demo/${slug}?token=${token}`,
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "No se pudo crear el demo link.",
		};
	}
}

export async function revokeDemoLinkAction(input: {
	tenantId: string;
	linkId: string;
}) {
	const tenantId = String(input.tenantId ?? "").trim();
	const linkId = String(input.linkId ?? "").trim();

	if (!tenantId || !linkId) {
		return { error: "Faltan datos para revocar el link." };
	}

	try {
		await assertTenantAdminAccess(tenantId);
		const admin = createSupabaseAdminClient();
		const { data: revokedLink, error } = await admin
			.from("tenant_demo_links")
			.update({ revoked_at: new Date().toISOString() })
			.eq("id", linkId)
			.eq("tenant_id", tenantId)
			.select("id")
			.maybeSingle();

		if (error) {
			console.error("[demo-links] revoke failed", error);
			return { error: error.message || "No se pudo revocar el demo link." };
		}
		if (!revokedLink) {
			return { error: "No se encontro el demo link para revocar." };
		}

		revalidatePath("/admin/demo-links");
		return { success: true };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "No se pudo revocar el demo link.",
		};
	}
}
