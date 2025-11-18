import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const body = await request.json();

		const { obraId, filePath, fileName, apsUrn, apsObjectId } = body;

		if (!obraId || !filePath || !fileName || !apsUrn) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Insert or update the APS model record
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
		const searchParams = request.nextUrl.searchParams;
		const obraId = searchParams.get("obraId");
		const filePath = searchParams.get("filePath");

		if (filePath) {
			// Get specific model by file path
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
		} else if (obraId) {
			// Get all models for an obra
			const { data, error } = await supabase
				.from("aps_models")
				.select("*")
				.eq("obra_id", obraId);

			if (error) {
				return NextResponse.json({ error: error.message }, { status: 500 });
			}

			return NextResponse.json({ data });
		} else {
			return NextResponse.json(
				{ error: "Missing obraId or filePath parameter" },
				{ status: 400 }
			);
		}
	} catch (error: any) {
		console.error("Error in GET /api/aps/models:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
