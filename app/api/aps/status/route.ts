import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const urn = searchParams.get("urn");

	if (!urn) {
		return NextResponse.json({ error: "URN is required" }, { status: 400 });
	}

	try {
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
		console.error("Status check error:", error);
		return NextResponse.json(
			{ error: error.message || "Status check failed" },
			{ status: 500 }
		);
	}
}
