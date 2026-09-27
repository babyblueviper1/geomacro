#!/usr/bin/env node

const AVAILABILITY_URL = "https://geomacro.live/api/x402/risk/availability";
const CANDIDATES = [
  ["USA", "United States"],
  ["CHN", "China"],
  ["IND", "India"],
  ["GBR", "United Kingdom"],
  ["DEU", "Germany"],
  ["JPN", "Japan"],
  ["FRA", "France"],
  ["CAN", "Canada"],
  ["AUS", "Australia"],
  ["BRA", "Brazil"],
];

function requestFor(countryIso3, countryName) {
  return {
    schema_version: "geomacro.agent-query.v1",
    question: `Should a treasury payment involving ${countryName} proceed based on the current Geomacro Risk Gate?`,
    subjects: [{ type: "country", country_iso3: countryIso3 }],
    topics: ["risk_object", "risk_gate"],
    evidence: "required",
    detail: "standard",
    risk_gate_context: {
      policy_preset: "balanced",
      action_type: "treasury_payment",
      amount_usdc: 1000,
    },
    client_request_id: `adaptive-x402-discovery-${countryIso3.toLowerCase()}-${Date.now()}`,
  };
}

async function main() {
  const attempts = [];
  for (const [countryIso3, countryName] of CANDIDATES) {
    const response = await fetch(AVAILABILITY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(requestFor(countryIso3, countryName)),
      redirect: "error",
    });
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch {}
    attempts.push({
      country_iso3: countryIso3,
      status: response.status,
      ok: body?.ok === true,
      chargeable: body?.chargeable === true,
      reason_codes: body?.availability?.reason_codes ?? body?.availability?.reasons ?? [],
    });
    if (response.status === 200 && body?.ok === true && body?.chargeable === true) {
      process.stdout.write(JSON.stringify({
        ok: true,
        country_iso3: countryIso3,
        country_name: countryName,
        query_plan_hash: body?.query_plan_hash ?? null,
        attempts,
      }));
      return;
    }
  }

  process.stdout.write(JSON.stringify({ ok: false, attempts }));
  process.exitCode = 3;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
