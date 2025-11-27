import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiValidationError, validateSearchParams } from "@/lib/http/validation";

const StatusQuerySchema = z.object({
	urn: z.string().min(1, "URN is required"),
});

export async function GET(request: NextRequest) {
	try {
		const { urn } = validateSearchParams(
			request.nextUrl.searchParams,
			StatusQuerySchema
		);

		const clientId = process.env.APS_CLIENT_ID!;
		const clientSecret = process.env.APS_CLIENT_SECRET!;

		// Get token
		const tokenResponse = await fetch(
			"https://developer.api.autodesk.com/authentication/v2/token",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					client_id: clientId,
					client_secret: clientSecret,
					grant_type: "client_credentials",
					scope: "data:read",
				}),
			}
		);

		const tokenData = await tokenResponse.json();

		// Check translation status
		const statusResponse = await fetch(
			`https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(
				urn
			)}/manifest`,
			{
				headers: {
					Authorization: `Bearer ${tokenData.access_token}`,
				},
			}
		);

		const statusData = await statusResponse.json();
		return NextResponse.json(statusData);
	} catch (error: any) {
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		console.error("Status check error:", error);
		return NextResponse.json(
			{ error: error.message || "Status check failed" },
			{ status: 500 }
		);
	}
}
