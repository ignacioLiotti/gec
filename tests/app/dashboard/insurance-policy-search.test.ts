import { describe, expect, it } from "vitest";

import {
  getInsurancePolicySearchSegments,
  matchesInsurancePolicyNumber,
  matchesInsurancePolicySearchValue,
} from "@/app/dashboard/insurance-policy-search";

describe("insurance policy number search", () => {
  it("matches the displayed policy number", () => {
    expect(matchesInsurancePolicyNumber("313584 / 19", "313584 / 19")).toBe(true);
  });

  it("ignores slash spacing", () => {
    expect(matchesInsurancePolicyNumber("313584 / 19", "313584/19")).toBe(true);
    expect(matchesInsurancePolicyNumber("313584/19", "313584 / 19")).toBe(true);
  });

  it("does not match a different policy number", () => {
    expect(matchesInsurancePolicyNumber("313584 / 19", "313584 / 20")).toBe(false);
  });

  it("matches other searchable accordion cell values", () => {
    expect(matchesInsurancePolicySearchValue("Caución", "caucion")).toBe(true);
  });

  it("highlights only the matching substring", () => {
    expect(getInsurancePolicySearchSegments("313584 / 19", "313584")).toEqual([
      { text: "313584", highlighted: true },
      { text: " / 19", highlighted: false },
    ]);
  });

  it("maps compact queries back to the displayed substring", () => {
    expect(getInsurancePolicySearchSegments("Póliza 313584 / 19 vigente", "313584/19")).toEqual([
      { text: "Póliza ", highlighted: false },
      { text: "313584 / 19", highlighted: true },
      { text: " vigente", highlighted: false },
    ]);
  });
});
