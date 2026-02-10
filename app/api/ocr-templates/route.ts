import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

type Region = {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	description?: string;
	color: string;
	type: "single" | "table";
	tableColumns?: string[];
};

type TemplateColumn = {
	fieldKey: string;
	label: string;
	dataType: string;
	ocrScope?: "parent" | "item";
	description?: string;
};

async function getAuthContext() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { supabase, user: null, tenantId: null };
	}

	const { data: membership } = await supabase
		.from("memberships")
		.select("tenant_id")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	return { supabase, user, tenantId: membership?.tenant_id ?? null };
}

export async function GET() {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ templates: [] });
	}

	try {
		const { data: templates, error } = await supabase
			.from("ocr_templates")
			.select("id, name, description, template_file_name, regions, columns, is_active, created_at")
			.eq("tenant_id", tenantId)
			.eq("is_active", true)
			.order("name", { ascending: true });

		if (error) throw error;

		return NextResponse.json({ templates: templates ?? [] });
	} catch (error) {
		console.error("[ocr-templates:get]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error loading templates" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ error: "No tenant found" }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));

		const name = typeof body.name === "string" ? body.name.trim() : "";
		console.log("[ocr-templates:post] tenant", tenantId, "user", user.id, "name", name);
		if (!name) {
			return NextResponse.json({ error: "Template name required" }, { status: 400 });
		}

		const description = typeof body.description === "string" ? body.description : null;
		const regions: Region[] = Array.isArray(body.regions) ? body.regions : [];
		
		// Validate regions have at least basic structure
		const validRegions = regions.filter(
			(r) =>
				typeof r.id === "string" &&
				typeof r.label === "string" &&
				typeof r.x === "number" &&
				typeof r.y === "number" &&
				typeof r.width === "number" &&
				typeof r.height === "number"
		);

		if (validRegions.length === 0) {
			return NextResponse.json(
				{ error: "At least one valid region required" },
				{ status: 400 }
			);
		}

		// Derive columns from regions
		const columns: TemplateColumn[] = [];
		for (const region of validRegions) {
			const regionDescription =
				typeof region.description === "string"
					? region.description.trim()
					: "";
			if (region.type === "single") {
				columns.push({
					fieldKey: region.label
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, "_")
						.replace(/^_|_$/g, "") || `field_${region.id}`,
					label: region.label,
					dataType: "text",
					ocrScope: "parent",
					description: regionDescription || undefined,
				});
			} else if (region.type === "table" && region.tableColumns) {
				for (const col of region.tableColumns) {
					columns.push({
						fieldKey: col
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, "_")
							.replace(/^_|_$/g, "") || `col_${Math.random().toString(36).slice(2, 8)}`,
						label: col,
						dataType: "text",
						ocrScope: "item",
						description: regionDescription || undefined,
					});
				}
			}
		}

		// Store template info
		const templateWidth = typeof body.templateWidth === "number" ? body.templateWidth : null;
		const templateHeight = typeof body.templateHeight === "number" ? body.templateHeight : null;
		const templateBucket = typeof body.templateBucket === "string" ? body.templateBucket : null;
		const templatePath = typeof body.templatePath === "string" ? body.templatePath : null;
		const templateFileName = typeof body.templateFileName === "string" ? body.templateFileName : null;

		const { data: existing, error: existingError } = await supabase
			.from("ocr_templates")
			.select("id, name, is_active, tenant_id")
			.eq("tenant_id", tenantId)
			.eq("name", name);

		if (existingError) {
			console.error("[ocr-templates:post] existing check failed", existingError);
		} else if (existing && existing.length > 0) {
			console.log("[ocr-templates:post] existing templates", existing);
		}

		const { data: template, error } = await supabase
			.from("ocr_templates")
			.insert({
				tenant_id: tenantId,
				name,
				description,
				template_bucket: templateBucket,
				template_path: templatePath,
				template_file_name: templateFileName,
				template_width: templateWidth,
				template_height: templateHeight,
				regions: validRegions,
				columns,
				is_active: true,
			})
			.select("id, name, description, template_file_name, regions, columns, is_active")
			.single();

		if (error) {
			const code = (error as any)?.code;
			const message = (error as any)?.message ?? "";
			if (code === "23505" && message.includes("ocr_templates_name_unique")) {
				console.log("[ocr-templates:post] duplicate name constraint", {
					tenantId,
					name,
				});
				return NextResponse.json(
					{
						error: "Ya existe una plantilla con ese nombre",
						code: "template_name_exists",
					},
					{ status: 409 },
				);
			}
			throw error;
		}

		return NextResponse.json({ template });
	} catch (error) {
		console.error("[ocr-templates:post]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error creating template" },
			{ status: 500 }
		);
	}
}

export async function DELETE(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ error: "No tenant found" }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const id = typeof body.id === "string" ? body.id : null;

		if (!id) {
			return NextResponse.json({ error: "Template ID required" }, { status: 400 });
		}

		// Soft delete by setting is_active to false
		const { error } = await supabase
			.from("ocr_templates")
			.update({ is_active: false })
			.eq("id", id)
			.eq("tenant_id", tenantId);

		if (error) throw error;

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[ocr-templates:delete]", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Error deleting template" },
			{ status: 500 }
		);
	}
}



