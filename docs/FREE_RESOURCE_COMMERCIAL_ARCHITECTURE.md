# Geomacro: bounded-cost commercial operating architecture

Status: design and implementation gate, 2026-09-27. This document does not activate mainnet payments, certify data rights, or claim an uptime guarantee.

## Decision

Run a small, paid pilot on free quotas only while every measured resource has headroom and every paid response has verified settlement and fresh, commercially eligible data. Free services do not provide unlimited storage, compute, requests, availability, support, or permanent pricing. A paid customer must receive a correct answer or an explicit unavailable response; lack of data must never be represented as low risk. No payment requirement is issued for a request whose canonical capability cannot currently deliver.

The current 0.05 USDC launch price yields 500 USDC gross for 10,000 completed deliveries, before all transaction/provider/hosting costs. A verified payment and completed delivery must reconcile under one request identity. Testnet receipts are never revenue.

## Current baseline and blockers

The owner supplied a production Supabase table-size report on 2026-09-27. The dashboard showed about 116% of the 500 MB database quota and 4.597 GB of monthly log ingestion against a 1 GB included amount. The largest relations were:

| Relation | Total size | Treatment |
| --- | ---: | --- |
| storage.objects | 106 MB, 51,612 estimated rows | Inventory by bucket/prefix and age. Migrate bytes with readback before deleting through the Storage API. Never delete storage.objects by SQL. |
| live_external_observations | 100 MB, 44,992 rows | Measure source, age, rights and raw_payload contribution. Keep required canonical observations; offload only reviewed raw fields with a versioned reader. |
| live_structured_events | 75 MB, 27,140 rows | Measure active versus resolved history and evidence references before archiving. |
| geomacro_risk_objects | 45 MB, 5,284 rows | Signed, immutable payloads; preserve verification and commercial audit references. |
| live_structured_event_evidence | 38 MB | Preserve provenance and independent-source proof. |
| live_fragment_manifest / live_raw_source_snapshots | 24 MB / 22 MB | Preserve chain and readback proofs; archive bytes and support alternate location resolution before any source removal. |
| live_recent_fingerprints | 20 MB, 73,780 rows | Expiring dedup cache, explicitly noncanonical. Bounded deletion of expired rows is the first safe cleanup candidate, after measuring expired count. |

The Global Coverage Readiness Gate run 36295216955 had 98 paid-ready and 96 fail-closed sovereign objects out of 194. Recent main also had failed coverage, live performance and deployment workflows. Passing static/prelaunch checks does not supersede these live failures.

## Target topology

1. **Public site:** Keep Lovable while publishing remains owner-controlled. An automatic Git-connected static deployment can be piloted separately, with the same canonical API endpoints and domain validation. No DNS cutover until preview, rollback and payment-origin checks pass. Static hosting is not a replacement for the API or database.
2. **Paid API:** Keep the current server-side entitlement, idempotency, x402 verification and delivery ledger. Preflight source rights, freshness, capability, database write availability and quota before returning a payment requirement. Return a retryable unavailable state without charging when a dependency is missing.
3. **Hot Postgres:** Only operational indices, current structured state, bounded recent history, commercial ledgers and archive pointers. Target at most 350 MB after verified remediation; warn at 400 MB, freeze new bulk ingest at 450 MB, and stop new paid quotes if durable settlement/audit writes cannot succeed. These thresholds are project policy, not Supabase's official quota.
4. **Private cold object store:** A provider such as Cloudflare R2 Standard for compressed, immutable historical raw bytes. Use a private bucket and scoped keys; record content hash, size, source identity, chain and storage location. R2's current free tier is 10 GB-month, 1 million Class A and 10 million Class B operations monthly. Batching and measured request budgets are required.
5. **Ingestion:** Stagger source polling, use HTTP conditional requests where supported, normalize before writing, and batch sealed evidence by source/time window. Preserve independent-source provenance. Never count an empty HTTP success as country evidence or duplicate copies as independent paths.
6. **Jobs:** GitHub Actions on the public repository can run the scheduled acquisition and checks, but scheduled starts can be delayed and are not a 24/7 process or uptime SLA. Record last successful run and data freshness; self-heal bounded retries; fail closed after freshness expiry.
7. **Observability and recovery:** Daily database/table/bucket/object/ingest/log budgets, latest successful source and settlement checks, encrypted off-site logical backup plus restore drill. Free Supabase does not provide downloadable managed backups. Preserve incident owner and emergency freeze.

## Migration order and reversible gates

| Phase | Change | Evidence required before advancing |
| --- | --- | --- |
| 0 | Read-only inventory using `scripts/ops/free-tier-capacity.sql`; identify expiry and data age by source and bucket prefix. | Measured reclaimable bytes, table dependencies, backup and rollback plan. |
| 1 | Prune only expired `live_recent_fingerprints` in small batches; tune future TTL and polling volume. | No duplicate admission regression; database size and bloat measured after vacuum; no live coverage loss. |
| 2 | Add private external archive and a storage-location resolver while leaving Supabase copies intact. | Upload, checksum, readback, authorization, tamper test and restore test on staging. |
| 3 | Dual-read archived fragments and snapshots, then copy old objects in bounded batches. | Same canonical hashes and structuring outputs from both locations; source-rights and chain proofs unchanged. |
| 4 | Only after the old location is no longer referenced, remove verified old objects through Supabase Storage API; archive or compact eligible historical database payloads with approved retention. | No dangling references; payment/risk-object audits pass; measured DB below 350 MB and stable growth for at least 7 days. |
| 5 | Configure automated site deployment and production payment provider/recipient; perform staging, then a single external production purchase and reconciliation. | Exact-head CI, live source/coverage, capacity, no-charge, settlement, refund/replay and rollback gates all pass. |

No deletion of `live_fragment_manifest`, signed Risk Objects, payment/delivery ledgers or `storage.objects` rows is authorized by this design. Immutability and legal/commercial retention have to be resolved per table before any archive removes hot copies.

## Quota and cost guard

- Model requests and writes per day against the actual free quota with at least 30% headroom; do not rely on average traffic alone. Cloudflare Workers Free currently permits 100,000 requests/day if selected for a future API edge, but current Geomacro services run elsewhere and would require migration.
- Measure R2 object count and Class A/B operations before connecting the 195-country raw mesh. A naïve object per country/category per 15-minute cycle would be 56,160 writes/day, over 1.6 million writes/month and above R2's free Class A tier. That is a worst-case planning scenario, not observed usage. Batch or suppress identical content with a verified freshness record.
- Keep a quota reserve for payment verification, reconciliation and incident recovery. When the reserve is exhausted, stop new paid quotes; do not accept money and hope a batch job later succeeds.
- Log ingest is separate from database size. Inspect service-level log volume, then reduce noisy statement, Edge Function and request logs without removing security/settlement evidence. Monthly already-ingested bytes cannot be undone by deleting database rows.
- Each provider and account has independent terms, quotas and outage risk. There is no honest zero-cost guarantee for unrestricted 24/7 commercial service. Define a paid upgrade trigger before quota exhaustion, funded from verified revenue rather than an unbounded founder commitment.

## Owner-controlled external setup

The owner must create and retain control of the private archive account/bucket, production payment recipient/provider credentials, DNS and hosting account. Never put keys into GitHub source or Lovable client variables. Staging secrets and production secrets remain separate. No mainnet activation or DNS switch is implied by merging this document.

References: Supabase database size and Free project pausing/backup docs; Cloudflare R2 pricing and Workers limits; GitHub Actions public-repository billing and scheduler limits; Geomacro's canonical commercial and pay-per-call contracts.
