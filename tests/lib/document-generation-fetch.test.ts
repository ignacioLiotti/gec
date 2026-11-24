import { afterEach, expect, it, vi } from "vitest";
import { fetchDocumentMutation } from "@/lib/document-generation-fetch";

const { refreshSession } = vi.hoisted(() => ({ refreshSession: vi.fn() }));
vi.mock("@/utils/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { refreshSession } }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("renews a rejected session once and retries with the same purchase order", async () => {
  const init = { method: "POST", body: JSON.stringify({ inputData: { cantidad: "1,234" } }) };
  const send = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", send);
  refreshSession.mockResolvedValue({ data: { session: {} }, error: null });

  expect((await fetchDocumentMutation("/api/document-generation/drafts", init)).status).toBe(201);
  expect(refreshSession).toHaveBeenCalledTimes(1);
  expect(send.mock.calls).toEqual([
    ["/api/document-generation/drafts", init],
    ["/api/document-generation/drafts", init],
  ]);
});

it("keeps the pending payload in the editor when the user needs to reauthenticate", async () => {
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", send);
  refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("expired") });
  await expect(fetchDocumentMutation("/api/document-generation/drafts", { method: "POST" })).rejects.toThrow("La sesión venció");
  expect(send).toHaveBeenCalledTimes(1);
});
