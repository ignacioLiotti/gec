import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { assertLocalE2ETarget } from "../helpers/local-target";

const syntheticMetadataSchema = z.object({
	fixture_namespace: z.string(),
	fixture_actor: z.literal("signup-boundary"),
});

function localClient(url: string, key: string) {
	return createClient(url, key, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
	});
}

test("public email signup remains disabled in the isolated authenticated stack", async () => {
	const target = assertLocalE2ETarget({ kind: "execution", env: process.env });
	const fixtureNamespace = `signup-boundary-${randomUUID()}`;
	const email = `${fixtureNamespace}@e2e.invalid`;
	const password = `${randomBytes(32).toString("base64url")}Aa1!`;
	const anonymous = localClient(
		target.supabaseUrl.href,
		target.supabaseAnonKey,
	);
	const admin = localClient(
		target.supabaseUrl.href,
		target.supabaseServiceRoleKey,
	);

	const result = await anonymous.auth.signUp({
		email,
		password,
		options: {
			data: {
				fixture_namespace: fixtureNamespace,
				fixture_actor: "signup-boundary",
			},
		},
	});

	try {
		expect(result.error?.code).toBe("signup_disabled");
		expect(result.data.session).toBeNull();
		expect(result.data.user).toBeNull();
	} finally {
		const returnedUser = result.data.user ?? result.data.session?.user;
		if (returnedUser) {
			const observed = await admin.auth.admin.getUserById(returnedUser.id);
			const metadata = syntheticMetadataSchema.safeParse(
				observed.data.user?.user_metadata,
			);
			if (
				observed.data.user?.email !== email ||
				!metadata.success ||
				metadata.data.fixture_namespace !== fixtureNamespace
			) {
				throw new Error(
					"Refusing to clean up a signup response that is not owned by this test.",
				);
			}
			const deleted = await admin.auth.admin.deleteUser(returnedUser.id);
			if (deleted.error) {
				throw new Error(
					`Failed to clean up the synthetic signup user: ${deleted.error.message}`,
				);
			}
		}
	}
});
