import { NextResponse } from "next/server";

export async function GET() {
	const clientId = process.env.APS_CLIENT_ID!;
	const clientSecret = process.env.APS_CLIENT_SECRET!;

	const response = await fetch(
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
				scope:
					"viewables:read data:read data:create data:write bucket:create bucket:read",
			}),
		}
	);

	const data = await response.json();
	return NextResponse.json(data);
}
