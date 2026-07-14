import { describe, expect, it } from "vitest";

import { canDeleteGeneratedDocument } from "@/lib/document-generation-server";

describe("generated document authorization", () => {
  it("allows only the user who generated the document to delete it", () => {
    expect(canDeleteGeneratedDocument({ userId: "user-1", generatedBy: "user-1" })).toBe(true);
    expect(canDeleteGeneratedDocument({ userId: "user-2", generatedBy: "user-1" })).toBe(false);
    expect(canDeleteGeneratedDocument({ userId: null, generatedBy: "user-1" })).toBe(false);
  });
});
