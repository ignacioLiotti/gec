import {
  getSearchHighlightSegments,
  matchesSearchHighlightValue,
  type SearchHighlightSegment,
} from "@/components/form-table/search-highlight";

export type InsurancePolicySearchSegment = SearchHighlightSegment;

export function matchesInsurancePolicySearchValue(value: string, query: string): boolean {
  return matchesSearchHighlightValue(value, query);
}

export function matchesInsurancePolicyNumber(policyNumber: string, query: string): boolean {
  return matchesSearchHighlightValue(policyNumber, query);
}

export function getInsurancePolicySearchSegments(value: string, query: string): InsurancePolicySearchSegment[] {
  return getSearchHighlightSegments(value, query);
}
