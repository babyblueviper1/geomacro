import { readFile } from "node:fs/promises";
import { buildCountryRiskObject, type CountryRiskEventInput } from "../src/lib/country-risk-engine";
import { applyCountryRiskCommercialEligibility, type StructuredEventCommercialEligibility } from "../src/lib/country-risk-commercial-eligibility";
import { assertFedericoPublicationReady } from "../src/lib/federico-publication-policy";

const vectorPath = new URL("../test-vectors/federico-strict-positive-control-v1.json", import.meta.url);
const vector = JSON.parse(await readFile(vectorPath, "utf8")) as {
  vector_version: string;
  country_iso3: string;
  as_of: string;
  calculation_namespace: string;
  events: CountryRiskEventInput[];
  commercial_eligibility: StructuredEventCommercialEligibility[];
  expected: {
    publication_policy_accepts: boolean;
    schema_version: string;
    decision_readiness_status: string;
    decision_readiness_reason_codes: string[];
    commercial_eligibility_status: string;
    verification_status: string;
    evidence_event_count: number;
    independent_source_count: number;
  };
};

const built = await buildCountryRiskObject({
  country_iso3: vector.country_iso3,
  as_of: vector.as_of,
  calculation_namespace: vector.calculation_namespace,
  events: vector.events,
});

const object = applyCountryRiskCommercialEligibility(
  built,
  vector.commercial_eligibility,
);

assertFedericoPublicationReady(object);

const actual = {
  publication_policy_accepts: true,
  schema_version: object.schema_version,
  decision_readiness_status: object.decision_readiness.status,
  decision_readiness_reason_codes: object.decision_readiness.reason_codes,
  commercial_eligibility_status: object.commercial_eligibility.status,
  verification_status: object.verification.status,
  evidence_event_count: object.evidence_summary.event_count,
  independent_source_count: object.evidence_summary.independent_source_count,
};

const expected = vector.expected;
const mismatches: string[] = [];
for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
  const expectedValue = expected[key];
  const actualValue = actual[key];
  if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
    mismatches.push(`${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
  }
}

if (mismatches.length) {
  throw new Error(`Federico positive-control mismatch:\n${mismatches.join("\n")}`);
}

console.log(JSON.stringify({
  ok: true,
  vector_version: vector.vector_version,
  policy_version: object.decision_readiness.policy_version,
  country_iso3: object.subject.id,
  object_id: object.object_id,
  publication_policy_accepts: true,
  evidence_summary: object.evidence_summary,
  decision_readiness: object.decision_readiness,
  commercial_eligibility: object.commercial_eligibility,
  verification: object.verification,
}, null, 2));
