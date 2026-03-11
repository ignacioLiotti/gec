import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UploadSource = {
	fileName: string;
	fileBuffer: ArrayBuffer;
	storagePath: string | null;
	obraId: string | null;
};

function sanitizeObjectKey(fileName: string, sourceKey: string) {
	const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
	const encodedSource = Buffer.from(sourceKey).toString("base64url").slice(0, 80);
	return `${encodedSource}-${safeName}`;
}

function resolveObraId(explicitObraId: FormDataEntryValue | null, storagePath: string | null) {
	if (typeof explicitObraId === "string" && UUID_REGEX.test(explicitObraId.trim())) {
		return explicitObraId.trim();
	}

	if (!storagePath) return null;
	const firstSegment = storagePath.split("/")[0] ?? "";
	return UUID_REGEX.test(firstSegment) ? firstSegment : null;
}

async function resolveUploadSource(request: NextRequest): Promise<UploadSource> {
	const formData = await request.formData();
	const fileEntry = formData.get("file");
	const storagePathEntry = formData.get("storagePath");
	const explicitFileName = formData.get("fileName");
	const obraId = resolveObraId(formData.get("obraId"), typeof storagePathEntry === "string" ? storagePathEntry : null);

	if (fileEntry instanceof File) {
		return {
			fileName: fileEntry.name,
			fileBuffer: await fileEntry.arrayBuffer(),
			storagePath: typeof storagePathEntry === "string" ? storagePathEntry : null,
			obraId,
		};
	}

	if (typeof storagePathEntry !== "string" || !storagePathEntry.trim()) {
		throw new Error("No file provided");
	}

	const storagePath = storagePathEntry.trim();
	const supabase = await createClient();
	const { data, error } = await supabase.storage.from("obra-documents").download(storagePath);
	if (error || !data) {
		throw new Error(error?.message ?? "No se pudo descargar el archivo desde storage");
	}

	const fallbackName = storagePath.split("/").pop() ?? "model-file";
	const fileName =
		typeof explicitFileName === "string" && explicitFileName.trim().length > 0
			? explicitFileName.trim()
			: fallbackName;

	return {
		fileName,
		fileBuffer: await data.arrayBuffer(),
		storagePath,
		obraId,
	};
}

async function getApsAccessToken() {
	const clientId = process.env.APS_CLIENT_ID;
	const clientSecret = process.env.APS_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("APS credentials not configured");
	}

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

	const tokenData = await tokenResponse.json().catch(() => null);
	if (!tokenResponse.ok || !tokenData?.access_token) {
		const detailedMessage =
			typeof tokenData?.developerMessage === "string" && tokenData.developerMessage.trim().length > 0
				? tokenData.developerMessage.trim()
				: typeof tokenData?.error_description === "string" && tokenData.error_description.trim().length > 0
					? tokenData.error_description.trim()
					: "Authentication failed";
		const errorCode =
			typeof tokenData?.errorCode === "string" && tokenData.errorCode.trim().length > 0
				? ` (${tokenData.errorCode.trim()})`
				: "";
		throw new Error(`${detailedMessage}${errorCode}`);
	}

	return {
		clientId,
		accessToken: tokenData.access_token as string,
	};
}

async function ensureBucket(accessToken: string, clientId: string) {
	const bucketKey = `${clientId.toLowerCase()}-bucket`.replace(/[^a-z0-9-]/g, "");
	const bucketResponse = await fetch(
		"https://developer.api.autodesk.com/oss/v2/buckets",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				bucketKey,
				policyKey: "transient",
			}),
		}
	);

	if (!bucketResponse.ok && bucketResponse.status !== 409) {
		const bucketError = await bucketResponse.json().catch(() => null);
		console.error("Bucket creation failed:", bucketError);
		throw new Error("Bucket creation failed");
	}

	return bucketKey;
}

async function uploadObjectToAps(accessToken: string, bucketKey: string, objectKey: string, fileBuffer: ArrayBuffer) {
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

	const signedUrlData = await signedUrlResponse.json().catch(() => null);
	if (!signedUrlResponse.ok || !signedUrlData?.urls?.[0] || !signedUrlData?.uploadKey) {
		console.error("Failed to get signed URL:", signedUrlData);
		throw new Error("Failed to get upload URL");
	}

	const uploadResponse = await fetch(signedUrlData.urls[0], {
		method: "PUT",
		headers: {
			"Content-Type": "application/octet-stream",
		},
		body: fileBuffer,
	});

	if (!uploadResponse.ok) {
		throw new Error("File upload to S3 failed");
	}

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

	const completeData = await completeResponse.json().catch(() => null);
	if (!completeResponse.ok || !completeData?.objectId) {
		console.error("Failed to complete upload:", completeData);
		throw new Error("Failed to complete upload");
	}

	return completeData.objectId as string;
}

async function startTranslation(accessToken: string, urn: string) {
	const translateResponse = await fetch(
		"https://developer.api.autodesk.com/modelderivative/v2/designdata/job",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				input: { urn },
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

	const translateData = await translateResponse.json().catch(() => null);
	if (!translateResponse.ok) {
		console.error("Translation request failed:", translateData);
		throw new Error("Translation failed");
	}

	return translateData;
}

async function persistApsModel({
	obraId,
	storagePath,
	fileName,
	urn,
	objectId,
}: {
	obraId: string;
	storagePath: string;
	fileName: string;
	urn: string;
	objectId: string;
}) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("aps_models")
		.upsert(
			{
				obra_id: obraId,
				file_path: storagePath,
				file_name: fileName,
				aps_urn: urn,
				aps_object_id: objectId,
				status: "processing",
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "file_path" }
		);

	if (error) {
		console.error("Failed to store APS model:", error);
	}
}

export async function POST(request: NextRequest) {
	try {
		const source = await resolveUploadSource(request);
		const { clientId, accessToken } = await getApsAccessToken();
		const bucketKey = await ensureBucket(accessToken, clientId);
		const objectKey = sanitizeObjectKey(
			source.fileName,
			source.storagePath ?? `${source.fileName}-${Date.now()}`
		);
		const objectId = await uploadObjectToAps(
			accessToken,
			bucketKey,
			objectKey,
			source.fileBuffer
		);
		const urn = Buffer.from(objectId).toString("base64");
		const translation = await startTranslation(accessToken, urn);

		if (source.obraId && source.storagePath) {
			await persistApsModel({
				obraId: source.obraId,
				storagePath: source.storagePath,
				fileName: source.fileName,
				urn,
				objectId,
			});
		}

		return NextResponse.json({
			urn,
			objectId,
			translation,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Upload failed";
		console.error("Upload error:", error);
		return NextResponse.json(
			{ error: message },
			{ status: message === "No file provided" ? 400 : 500 }
		);
	}
}
