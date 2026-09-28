# Geomacro Zero-Cost Hybrid Intelligence Architecture

Status: implementation contract, 2026-09-28.

## Objective

Geomacro must not attempt to permanently store the world's raw data. The system should keep recurring internal cost at zero or as close to zero as practical while still answering questions with fresh structured intelligence.

The runtime has exactly three data modes:

1. `permanent`
2. `ephemeral_live`
3. `short_cache`

The user-facing answer does not expose source names, domains, URLs, source IDs, or raw payloads. Geomacro may use those fields privately for retrieval, deduplication, corroboration, rights checks, audit, and hallucination prevention.

## 1. Permanent data

Purpose: retain only information whose long-term value justifies durable storage.

Keep in Supabase only:

- compact searchable indices
- current normalized state
- canonical risk objects and required proof/commerce ledgers
- object-store pointers, hashes, timestamps and small provenance metadata
- bounded recent operational history

Keep large historical raw/canonical blobs in the private B2 archive only when they are required for audit, legal/commercial proof, reproducibility, or a known high-value recurring capability.

Do not permanently store arbitrary live-query raw results.

Cost policy:

- Supabase is a hot metadata/state database, not a data lake.
- B2 is the bounded cold archive for selected durable objects, not an automatic sink for every web result.
- New bulk ingestion must fail closed when database headroom is below the configured safety threshold.
- Historical raw data that has safely migrated to B2 is read from B2 through its versioned pointer/hash contract rather than copied back into Supabase.

## 2. Ephemeral live data

Purpose: answer questions whose required fresh data is absent or stale internally.

Flow:

`question -> internal sufficiency check -> live adapters -> raw in request memory -> normalize -> deduplicate -> cross-source verify -> structure -> sanitize -> answer -> discard raw`

Rules:

- no Supabase insert
- no Supabase Storage upload
- no B2 upload by default
- no durable cache write
- no source identity in public output
- raw payload lifetime is limited to the request/runtime memory
- external retrieval uses free/public endpoints only unless a paid provider is explicitly configured and independently budgeted
- unsupported or weakly verified findings return `insufficient_evidence` rather than fabricated certainty

Public wording for successful live retrieval:

`Geomacro found these factors in real time based on your question.`

Public wording for weak live evidence:

`Geomacro searched in real time based on your question, but did not find enough independently verified evidence for a stronger answer.`

## 3. Short cache

Purpose: avoid repeated external calls for identical/similar requests without creating another durable storage problem.

Default implementation:

- process-memory only
- default TTL: 5 minutes
- default maximum entries: 128 per runtime instance
- only sanitized structured answers are cached
- raw source payloads, URLs, domains, source IDs and private provenance are never cached
- cache disappears on deploy/restart/scale-down

This makes the default short cache zero-storage-cost and zero-database-write-cost.

A distributed cache may be added later only when measured paid traffic justifies it. It is not a launch dependency.

## Query routing contract

Priority order:

1. Use permanent internal intelligence when it is sufficiently relevant and fresh.
2. Otherwise serve a valid short-cache hit.
3. Otherwise retrieve live data and structure it ephemerally.
4. If evidence remains insufficient, return an explicit insufficient-evidence response.

For requests containing freshness language such as `now`, `current`, `today`, `latest`, or a very short explicit time window, callers may set `forceLive=true` so stale permanent/cache data cannot override the live requirement.

## Public response contract

Every hybrid answer should identify how it was produced without exposing sources:

```json
{
  "data_mode": "ephemeral_live",
  "message": "Geomacro found these factors in real time based on your question.",
  "source_identity_exposed": false,
  "durable_live_storage_write": false,
  "findings": [],
  "insufficient_evidence": false,
  "generated_at": "..."
}
```

Allowed public fields include structured facts, metrics, event types, timestamps, categories, country/entity identifiers, confidence indicators, corroboration counts and Geomacro's synthesized explanation.

Disallowed public source fields include source names, publisher names, URLs, domains, source IDs, raw payloads and private provenance identifiers.

## Private verification contract

Source identity remains available only inside the trusted runtime long enough to:

- deduplicate records
- compare independent publisher/source families
- verify source rights and eligibility where commercial delivery requires it
- calculate corroboration/confidence
- detect conflicting evidence
- prevent one duplicated story from being counted as many independent confirmations

The public response may disclose only aggregate verification information, such as `independent_source_count`, never the identities themselves.

## Cost guardrails

The architecture targets near-zero internal recurring cost, not a guarantee that third-party free tiers or pricing will never change.

Default controls:

- no paid search API required for live fallback
- no live-query database writes
- no live-query object-storage writes
- in-memory TTL cache only
- bounded result counts
- bounded request timeout
- conditional requests where supported
- release/event-driven polling for permanent datasets instead of high-frequency polling
- stop/fail closed rather than cross a configured quota or store unnecessary data

Before enabling any provider that can charge per request/token/byte, it must have an explicit per-request budget, daily ceiling and hard disable path.

## Current production constraint

The existing production database contains historical material from the previous store-heavy architecture. The new architecture prevents arbitrary live-query growth, but existing durable tables still require the separate verified B2 migration/retention program before database usage returns to the desired hot-state envelope.

No raw data should be deleted merely because this architecture exists. Migration requires verified B2 write, hash/readback validation, pointer-aware readers, retention eligibility and a measured reclaim step.

## Implemented runtime

`global-intelligence/engine/intelligence-engine.mjs` implements:

- optional permanent reader
- process-memory short cache
- ephemeral live retrieval
- internal cross-source verification
- public source stripping
- explicit `data_mode`
- explicit no-durable-live-write contract
- insufficient-evidence behavior

The canonical app/API surfaces should call this runtime (or preserve the identical contract) rather than creating another store-everything fallback path.
