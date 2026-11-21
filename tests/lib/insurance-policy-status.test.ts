import { describe, expect, it } from "vitest";
import { getInsurancePolicyStatus } from "../../lib/insurance-policy-status";

const now = new Date(2026, 8, 7, 12);
const policy = { isCancelled: false, endDate: "2026-12-31", calculatedCancellationDate: null };
describe("shared policy status", () => {
  it("shows expired coverage even when cancellation is scheduled later", () => {
    expect(getInsurancePolicyStatus({ ...policy, endDate: "2026-09-06", calculatedCancellationDate: "2027-01-01" }, now)).toBe("expired");
  });
  it("gives confirmed cancellation precedence over expired coverage", () => {
    expect(getInsurancePolicyStatus({ ...policy, isCancelled: true, endDate: "2020-01-01" }, now)).toBe("cancelled");
  });
  it("keeps the 60 day cancellation window inclusive", () => {
    expect(getInsurancePolicyStatus({ ...policy, calculatedCancellationDate: "2026-11-06" }, now)).toBe("dueSoon");
    expect(getInsurancePolicyStatus({ ...policy, calculatedCancellationDate: "2026-11-07" }, now)).toBe("active");
  });
  it("does not invent a cancellation deadline from coverage or invalid dates", () => {
    expect(getInsurancePolicyStatus({ ...policy, endDate: "2026-09-08" }, now)).toBe("active");
    expect(getInsurancePolicyStatus({ ...policy, endDate: null, calculatedCancellationDate: "invalid" }, now)).toBe("active");
  });
});
