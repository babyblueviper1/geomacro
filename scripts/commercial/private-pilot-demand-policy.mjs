import { readFileSync } from "node:fs";

const policy = JSON.parse(readFileSync(new URL("../../config/private-pilot-demand.v1.json", import.meta.url), "utf8"));
const registry = JSON.parse(readFileSync(new URL("../../global-intelligence/sources/source-registry.v1.json", import.meta.url), "utf8"));

export const PRIVATE_PILOT_POLICY = policy;

// Advisory only: this function neither fetches sources nor changes paid eligibility.
export function recommendPilotFocus(signals, certifiedSources) {
  const approved = new Set(certifiedSources.filter((item) =>
    item.certified === true && item.commercial_rights === true && item.live_eligible === true
  ).map((item) => item.id));
  const recommendations = [];

  for (const [category, rules] of Object.entries(policy.category_policy)) {
    const registered = new Set(registry.categories[category].map((source) => source.id));
    const eligible = rules.preferred_source_families.filter((id) => registered.has(id) && approved.has(id));
    const relevant = signals.filter((signal) => signal.category === category && rules.topics.includes(signal.topic));
    const paid = relevant.filter((signal) => signal.external === true && signal.settled === true && signal.delivered === true && signal.refunded !== true);
    const distinctBuyers = new Set(paid
      .map((signal) => signal.buyer_id).filter(Boolean)).size;
    const successfulDeliveries = paid.length;
    const unmetRequests = relevant.filter((signal) => signal.external === true && signal.unmet === true).length;
    recommendations.push({
      category,
      successful_deliveries: successfulDeliveries,
      distinct_external_buyers: distinctBuyers,
      unmet_requests: unmetRequests,
      demand_validated: distinctBuyers >= policy.automation_boundaries.minimum_distinct_external_buyers_for_demand_claim,
      eligible_source_ids: eligible,
      maximum_extra_polls_per_day: eligible.length ? rules.maximum_extra_polls_per_day : 0,
      action: eligible.length ? "REVIEW_SCHEDULE_PRIORITY" : "SOURCE_CERTIFICATION_REQUIRED",
    });
  }

  return recommendations.sort((a, b) =>
    b.distinct_external_buyers - a.distinct_external_buyers ||
    b.successful_deliveries - a.successful_deliveries ||
    b.unmet_requests - a.unmet_requests ||
    a.category.localeCompare(b.category)
  );
}
