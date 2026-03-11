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
		if (!tokenResponse.ok || !tokenData?.access_token) {
			const message =
				typeof tokenData?.developerMessage === "string" && tokenData.developerMessage.trim().length > 0
					? tokenData.developerMessage.trim()
					: "Failed to obtain APS token";
			return NextResponse.json(
				{
					error: message,
					code:
						typeof tokenData?.errorCode === "string" && tokenData.errorCode.trim().length > 0
							? tokenData.errorCode.trim()
							: undefined,
					detail: tokenData,
				},
				{ status: tokenResponse.status }
			);
		}

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
		if (!statusResponse.ok) {
			return NextResponse.json(
				{
					error:
						typeof statusData?.developerMessage === "string" && statusData.developerMessage.trim().length > 0
							? statusData.developerMessage.trim()
							: "Failed to obtain APS model status",
					code:
						typeof statusData?.errorCode === "string" && statusData.errorCode.trim().length > 0
							? statusData.errorCode.trim()
							: undefined,
					detail: statusData,
				},
				{ status: statusResponse.status }
			);
		}
		return NextResponse.json(statusData);
	} catch (error: unknown) {
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		console.error("Status check error:", error);
		const message =
			error instanceof Error ? error.message : "Status check failed";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}
