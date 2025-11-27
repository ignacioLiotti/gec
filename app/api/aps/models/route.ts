import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import {
	ApiValidationError,
	validateJsonBody,
	validateSearchParams,
} from "@/lib/http/validation";

const ApsModelSchema = z.object({
	obraId: z.string().uuid(),
	filePath: z.string().min(1),
	fileName: z.string().min(1),
	apsUrn: z.string().min(1),
	apsObjectId: z.string().optional(),
});

const GetQuerySchema = z
	.object({
		obraId: z.string().uuid().optional(),
		filePath: z.string().min(1).optional(),
	})
	.refine((val) => val.obraId || val.filePath, {
		message: "Missing obraId or filePath parameter",
	});

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { obraId, filePath, fileName, apsUrn, apsObjectId } =
			await validateJsonBody(request, ApsModelSchema);

		const { data, error } = await supabase
			.from("aps_models")
			.upsert(
				{
					obra_id: obraId,
					file_path: filePath,
					file_name: fileName,
					aps_urn: apsUrn,
					aps_object_id: apsObjectId,
					status: "processing",
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "file_path" }
			)
			.select()
			.single();

		if (error) {
			console.error("Error storing APS model:", error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ success: true, data });
	} catch (error: any) {
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		console.error("Error in POST /api/aps/models:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const { obraId, filePath } = validateSearchParams(
			request.nextUrl.searchParams,
			GetQuerySchema
		);

		if (filePath) {
			const { data, error } = await supabase
				.from("aps_models")
				.select("*")
				.eq("file_path", filePath)
				.single();

			if (error) {
				if (error.code === "PGRST116") {
					return NextResponse.json({ data: null });
				}
				return NextResponse.json({ error: error.message }, { status: 500 });
			}

			return NextResponse.json({ data });
		}

		const { data, error } = await supabase
			.from("aps_models")
			.select("*")
			.eq("obra_id", obraId);

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ data });
	} catch (error: any) {
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		console.error("Error in GET /api/aps/models:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
