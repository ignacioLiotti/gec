import { expect, test } from "../fixtures/public";

test("GET /api/obras requires authentication", async ({ request }) => {
	const response = await request.get("/api/obras");

	expect(response.status()).toBe(401);
	await expect(response.json()).resolves.toMatchObject({
		error: "Unauthorized",
	});
});
