import { describe, expect, it } from "vitest";

import {
  canDeleteGeneratedDocument,
  canEditGeneratedDocument,
} from "@/lib/document-generation-server";

describe("generated document authorization", () => {
  it.each(["GENERATED", "UNDER_REVIEW", "APPROVED", "REJECTED"])(
    "allows users with create permission to edit %s documents",
    (status) => {
      expect(canEditGeneratedDocument({ canCreate: true, userId: "user-1", status })).toBe(true);
    },
  );

  it("does not allow editing cancelled documents or editing without create permission", () => {
    expect(
      canEditGeneratedDocument({ canCreate: true, userId: "user-1", status: "CANCELLED" }),
    ).toBe(false);
    expect(
      canEditGeneratedDocument({ canCreate: false, userId: "user-1", status: "APPROVED" }),
    ).toBe(false);
    expect(
      canEditGeneratedDocument({ canCreate: true, userId: null, status: "APPROVED" }),
    ).toBe(false);
  });

  it("allows only the user who generated the document to delete it", () => {
    expect(canDeleteGeneratedDocument({ userId: "user-1", generatedBy: "user-1" })).toBe(true);
    expect(canDeleteGeneratedDocument({ userId: "user-2", generatedBy: "user-1" })).toBe(false);
    expect(canDeleteGeneratedDocument({ userId: null, generatedBy: "user-1" })).toBe(false);
  });
});
