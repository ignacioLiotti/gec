import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiValidationError, validateFormData } from "@/lib/http/validation";

const UploadSchema = z.object({
	file: z.instanceof(File, { message: "No file provided" }),
});

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const { file } = validateFormData(formData, UploadSchema);

		const clientId = process.env.APS_CLIENT_ID;
		const clientSecret = process.env.APS_CLIENT_SECRET;

		if (!clientId || !clientSecret) {
			console.error("Missing APS credentials");
			return NextResponse.json(
				{ error: "APS credentials not configured" },
				{ status: 500 }
			);
		}

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
					scope: "data:write data:read bucket:create bucket:read",
				}),
			}
		);

		const tokenData = await tokenResponse.json();

		if (!tokenResponse.ok) {
			console.error("Token request failed:", tokenData);
			return NextResponse.json(
				{ error: `Authentication failed` },
				{ status: 500 }
			);
		}

		const accessToken = tokenData.access_token;

		if (!accessToken) {
			console.error("No access token in response:", tokenData);
			return NextResponse.json(
				{ error: "Failed to get access token" },
				{ status: 500 }
			);
		}

		// Create bucket (if doesn't exist)
		const bucketKey = `${clientId.toLowerCase()}-bucket`.replace(/[^a-z0-9-]/g, '');
		const bucketResponse = await fetch(
			"https://developer.api.autodesk.com/oss/v2/buckets",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					bucketKey: bucketKey,
					policyKey: "transient",
				}),
			}
		);

		// Read response regardless of status
		const bucketData = await bucketResponse.json().catch(() => null);

		// Bucket might already exist (409), which is fine
		if (!bucketResponse.ok && bucketResponse.status !== 409) {
			console.error("Bucket creation failed:", bucketData);
			return NextResponse.json(
				{ error: `Bucket creation failed` },
				{ status: 500 }
			);
		}

		// Upload file using signed URL method
		const objectKey = file.name;
		const fileBuffer = await file.arrayBuffer();

		console.log(`Uploading file: ${file.name} to bucket: ${bucketKey}`);

		// Get signed upload URL
		const signedUrlResponse = await fetch(
			`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(
				objectKey
			)}/signeds3upload`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const signedUrlData = await signedUrlResponse.json();

		if (!signedUrlResponse.ok) {
			console.error("Failed to get signed URL:", signedUrlData);
			return NextResponse.json(
				{ error: `Failed to get upload URL` },
				{ status: 500 }
			);
		}

		// Upload to signed URL
		const uploadResponse = await fetch(signedUrlData.urls[0], {
			method: "PUT",
			headers: {
				"Content-Type": "application/octet-stream",
			},
			body: fileBuffer,
		});

		if (!uploadResponse.ok) {
			console.error("S3 upload failed:", uploadResponse.status);
			return NextResponse.json(
				{ error: `File upload to S3 failed` },
				{ status: 500 }
			);
		}

		// Complete upload
		const completeResponse = await fetch(
			`https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(
				objectKey
			)}/signeds3upload`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					uploadKey: signedUrlData.uploadKey,
				}),
			}
		);

		const completeData = await completeResponse.json();

		if (!completeResponse.ok) {
			console.error("Failed to complete upload:", completeData);
			return NextResponse.json(
				{ error: `Failed to complete upload` },
				{ status: 500 }
			);
		}

		if (!completeData.objectId) {
			console.error("No objectId in upload response:", completeData);
			return NextResponse.json(
				{ error: "Upload failed - no objectId received" },
				{ status: 500 }
			);
		}

		const uploadData = completeData;

		// Convert objectId to base64 URN
		const urn = Buffer.from(uploadData.objectId).toString("base64");

		// Start translation
		console.log(`Starting translation for URN: ${urn}`);

		const translateResponse = await fetch(
			"https://developer.api.autodesk.com/modelderivative/v2/designdata/job",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					input: {
						urn: urn,
					},
					output: {
						formats: [
							{
								type: "svf",
								views: ["2d", "3d"],
							},
						],
					},
				}),
			}
		);

		const translateData = await translateResponse.json();

		if (!translateResponse.ok) {
			console.error("Translation request failed:", translateData);
			return NextResponse.json(
				{ error: `Translation failed` },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			urn: urn,
			objectId: uploadData.objectId,
			translation: translateData,
		});
	} catch (error: any) {
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		console.error("Upload error:", error);
		return NextResponse.json(
			{ error: error.message || "Upload failed" },
			{ status: 500 }
		);
	}
}
