import { createClient } from "@supabase/supabase-js";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_TENANT_NAME = "Default Tenant";

function getAdminClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceRoleKey) {
		throw new Error(
			"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for E2E auth bootstrap.",
		);
	}

	return createClient(url, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

export async function ensureE2EUser(params: {
	email: string;
	password: string;
}) {
	const admin = getAdminClient();

	const { data: tenantData, error: tenantError } = await admin
		.from("tenants")
		.upsert(
			{
				id: DEFAULT_TENANT_ID,
				name: DEFAULT_TENANT_NAME,
			},
			{ onConflict: "id" },
		)
		.select("id")
		.single();

	if (tenantError || !tenantData) {
		throw new Error(
			`Failed to ensure default tenant for E2E auth: ${tenantError?.message ?? "unknown error"}`,
		);
	}

	const { data: usersData, error: listError } = await admin.auth.admin.listUsers();
	if (listError) {
		throw new Error(`Failed to list auth users: ${listError.message}`);
	}

	const existingUser = usersData.users.find(
		(user) => user.email?.toLowerCase() === params.email.toLowerCase(),
	);

	const userId = existingUser?.id;

	if (!userId) {
		const { data: createdUser, error: createError } =
			await admin.auth.admin.createUser({
				email: params.email,
				password: params.password,
				email_confirm: true,
			});

		if (createError || !createdUser.user) {
			throw new Error(
				`Failed to create E2E user: ${createError?.message ?? "unknown error"}`,
			);
		}

		await ensureMembership(admin, createdUser.user.id);
		return;
	}

	const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
		password: params.password,
		email_confirm: true,
	});
	if (updateError) {
		throw new Error(`Failed to update E2E user: ${updateError.message}`);
	}

	await ensureMembership(admin, userId);
}

async function ensureMembership(admin: ReturnType<typeof getAdminClient>, userId: string) {
	const { error: membershipError } = await admin.from("memberships").upsert(
		{
			tenant_id: DEFAULT_TENANT_ID,
			user_id: userId,
			role: "owner",
		},
		{ onConflict: "tenant_id,user_id" },
	);

	if (membershipError) {
		throw new Error(
			`Failed to ensure E2E user membership: ${membershipError.message}`,
		);
	}
}
