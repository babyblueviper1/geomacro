#!/usr/bin/env node
// Read-only owner report. Never exports buyer identifiers or private delivery snapshots.
import { createClient } from "@supabase/supabase-js";
import { recommendPilotFocus } from "./private-pilot-demand-policy.mjs";

const url = String(process.env.APP_SUPABASE_URL ?? "");
const key = String(process.env.APP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
if (!url || !key || new URL(url).hostname !== "ldpwajisioljyjtojvfx.supabase.co") {
  throw new Error("AUTHORITATIVE_SUPABASE_CREDENTIALS_REQUIRED");
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const categoryByCapability = {
  geopolitical_security: "GEOPOLITICS",
  sanctions_restrictions: "GEOPOLITICS",
  political_governance: "GEOPOLITICS",
  macro_monetary: "MACRO",
  external_fx: "MACRO",
  sovereign_fiscal: "MACRO",
  banking_financial_system: "MACRO",
  critical_minerals: "CRITICAL_MINERALS",
};
const topicByCapability = {
  geopolitical_security: "conflict_geopolitics",
  sanctions_restrictions: "sanctions_restrictions",
  political_governance: "political_governance",
  macro_monetary: "macro_risk",
  external_fx: "fx_external_risk",
  sovereign_fiscal: "sovereign_risk",
  banking_financial_system: "banking_financial_system",
  critical_minerals: "critical_minerals",
};

async function pages(table, columns, limit = 11000) {
  const rows = [];
  const orderColumn = table === "private_commercial_revenue_delivery_ledger" ? "sequence_no" : "source_id";
  for (let start = 0; start < limit; start += 500) {
    const { data, error } = await db.from(table).select(columns).order(orderColumn).range(start, Math.min(start + 499, limit - 1));
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

const proof = await pages("private_commercial_revenue_delivery_ledger", "sequence_no,payment_event_id,request_id,capability,payer_reference_hash,principal_id,amount_decimal,asset_symbol,environment");
const sourceRows = await pages("live_source_certification_records", "source_id,certification_state,rights_status,runtime_status,freshness_status");
// If either result is truncated, stop: a partial window could misrank demand.
if (proof.truncated || sourceRows.truncated) throw new Error("PILOT_REPORT_PAGE_LIMIT_REACHED");
const ids = proof.rows.map((row) => row.payment_event_id);
const payments = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await db.from("commercial_payment_events")
    .select("id,payment_status,refunded_at,disputed_at,reconciliation_status,commercial_revenue")
    .in("id", ids.slice(i, i + 200));
  if (error) throw error;
  for (const row of data) payments.set(row.id, row);
}
const seenRequests = new Set();
const signals = proof.rows.flatMap((row) => {
  const payment = payments.get(row.payment_event_id);
  const category = categoryByCapability[row.capability];
  if (!category || !payment || payment.payment_status !== "settled" ||
      payment.refunded_at || payment.disputed_at || payment.reconciliation_status !== "matched" ||
      payment.commercial_revenue !== true || row.environment !== "mainnet" ||
      row.asset_symbol !== "USDC" || Number(row.amount_decimal) !== 0.05 ||
      seenRequests.has(row.request_id)) return [];
  seenRequests.add(row.request_id);
  return [{ category, topic: topicByCapability[row.capability], buyer_id: row.principal_id ?? row.payer_reference_hash,
    external: true, settled: true, delivered: true }];
});
const certified = sourceRows.rows.map((row) => ({
  id: row.source_id,
  certified: row.certification_state === "CERTIFIED",
  commercial_rights: row.rights_status === "COMMERCIAL_OK",
  live_eligible: row.runtime_status === "PASS" && ["FRESH", "VARIABLE"].includes(row.freshness_status),
}));
const recommendations = recommendPilotFocus(signals, certified);
console.log(JSON.stringify({ generated_at: new Date().toISOString(), read_only: true,
  scope: "0.05 USDC mainnet, matched external commerce proof, nonrefunded and nondisputed; exact capability mapping only",
  counted_deliveries: signals.length, unmapped_or_ineligible_proof_rows: proof.rows.length - signals.length,
  recommendations }, null, 2));
