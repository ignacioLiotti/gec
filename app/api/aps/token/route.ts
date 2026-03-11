import { NextResponse } from "next/server";

export async function GET() {
	const clientId = process.env.APS_CLIENT_ID!;
	const clientSecret = process.env.APS_CLIENT_SECRET!;

	try {
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

		if (!response.ok) {
			const errBody = await response.json().catch(() => ({}));
			return NextResponse.json(
				{
					error:
						typeof errBody?.developerMessage === "string" && errBody.developerMessage.trim().length > 0
							? errBody.developerMessage.trim()
							: "Failed to obtain APS token",
					code:
						typeof errBody?.errorCode === "string" && errBody.errorCode.trim().length > 0
							? errBody.errorCode.trim()
							: undefined,
					detail: errBody,
				},
				{ status: response.status }
			);
		}

		const data = await response.json();
		if (!data.access_token) {
			return NextResponse.json(
				{ error: "APS token response missing access_token" },
				{ status: 502 }
			);
		}
		return NextResponse.json(data);
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : "Token request failed";
		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		);
	}
}
