#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const url = String(process.env.APP_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
const role = String(
  process.env.APP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
).trim();

if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !role) {
  throw new Error("SUPABASE_FREE_TIER_BUDGET_CONFIG_INVALID");
}

const db = createClient(url, role, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await db.rpc("geomacro_free_tier_budget_state");
if (error || !data) throw error ?? new Error("SUPABASE_FREE_TIER_BUDGET_UNAVAILABLE");

const result = {
  ok: true,
  ...data,
  policy: {
    supabase_role: "compact_operational_control_plane",
    b2_role: "raw_archive_historical_large_payloads",
    bulk_supabase_writes_allowed: data.bulk_write_allowed === true,
  },
};
console.log(JSON.stringify(result));

if (process.argv.includes("--require-bulk-write") && data.bulk_write_allowed !== true) {
  process.exitCode = 78;
}
