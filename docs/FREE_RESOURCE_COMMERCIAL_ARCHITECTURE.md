# Geomacro: bounded-cost commercial operating architecture

Status: design and implementation gate, 2026-09-27. This document does not activate mainnet payments, certify data rights, or claim an uptime guarantee.

## Decision

Run a small, paid pilot on free quotas only while every measured resource has headroom and every paid response has verified settlement and fresh, commercially eligible data. Free services do not provide unlimited storage, compute, requests, availability, support, or permanent pricing. A paid customer must receive a correct answer or an explicit unavailable response; lack of data must never be represented as low risk. No payment requirement is issued for a request whose canonical capability cannot currently deliver.

The current 0.05 USDC launch price yields 500 USDC gross for 10,000 completed deliveries, before all transaction/provider/hosting costs. A verified payment and completed delivery must reconcile under one request identity. Testnet receipts are never revenue.

## First 10,000 paid deliveries and global demand

The target is **10,000 distinct successfully settled and delivered customer requests at 0.05 USDC each = 500 USDC gross**, denominated in USDC. It is not a promise of 500 USD cash, net profit, or founder-funded test traffic. Count exactly one delivery per verified settlement and idempotency key; refunded, failed, testnet, replayed, internal and unpaid requests do not count. Reconcile funds actually received, payment/provider/network fees, refunds and operating cost daily. Withdraw or upgrade only from available reconciled funds after retaining a reserve for settlement disputes and service recovery.

| Stage | Cumulative paid deliveries | Gross USDC at launch price | Evidence to advance |
| --- | ---: | ---: | --- |
| Controlled production pilot | 100 | 5 | At least two unrelated external buyers, audited delivery and no-charge failure handling; no founder purchases counted. |
| Repeat-use validation | 1,000 | 50 | Multiple buyers repeat within their normal workflow; observed per-delivery cost, uptime and rights eligibility stay inside budget. |
| Expansion | 5,000 | 250 | Usage survives more than one source-release cycle; documented use cases, support burden, retention and gross margin. |
| Upgrade decision | 10,000 | 500 | Distinct paid request ledger reconciles with provider statements and delivered response IDs; allocate the net available balance to the measured bottleneck. |

These buyer counts are advancement criteria, not forecasts. Ten thousand calls from one buyer demonstrate usage but weak evidence of broad demand. Do not inflate paid volume with our own wallets or charge for unavailable coverage. At 0.05 USDC, even a 0.01 USDC variable cost per delivery consumes 100 USDC over 10,000 calls before fixed costs; measure this instead of assuming the full 500 USDC can fund upgrades.

The first global wedge is a narrow, verifiable machine-readable country risk/change feed for agent builders, cross-border operations and research automation. Publish a public schema, a no-payment sample with provenance and freshness, 3 copyable integration examples (country event change, macro release change, mineral supply/policy change), a status/coverage page and a clear 402 payment example. The sample must use rights-cleared data, show stale/unavailable explicitly and never masquerade as paid delivery. Prioritize regions and capabilities that pass live readiness; show the coverage map and do not advertise 194 paid-ready countries while 96 remain fail-closed.

Recruit a small set of design partners in at least three independent markets or workflows. Ask each what decision they make, what current data costs them, how fresh a signal must be, how they would integrate it, and whether they will make a real paid call. Record consented interviews and product feedback, then offer a trial integration with their own production payment. Distribute the integration through developer documentation, relevant agent/API catalogs and technical demos; measure qualified visits -> successful integration -> first external paid delivery -> repeat buyer -> retained weekly buyer. Record buyer geography, use case, category, failure reason, latency, rights and margin without collecting unnecessary personal data. Iterate the category and country scope using observed repeat purchases, not impressions or social reach.

A funding evidence pack should contain a working demo, independently verifiable paid receipts, cohort-based repeat buyers, category demand, real unit economics, coverage and licensing evidence, uptime/incident history, and a concrete use of funds (for example database headroom and reliable compute). Seek grant, partner or investor conversations only with accurate traction; 500 USDC gross alone is not proof of product-market fit or funding eligibility. No claim of investment return or guaranteed funding is implied.

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
6. **Jobs:** Move the existing Node/Bun/Python orchestrator to an independently operated, supervised Always Free VM after its GitHub OIDC dependencies have been replaced and verified. Keep GitHub Actions as the current scheduler until a measured shadow run and a single-owner cutover. Record last successful run and data freshness; self-heal bounded retries; fail closed after freshness expiry.
7. **Observability and recovery:** Daily database/table/bucket/object/ingest/log budgets, latest successful source and settlement checks, encrypted off-site logical backup plus restore drill. Free Supabase does not provide downloadable managed backups. Preserve incident owner and emergency freeze.

## Multiple free sources per category

The registry currently describes 17 geopolitics, 19 macro and 12 critical-minerals source families; these counts are candidate families, not certified live coverage for every country. Maintain a source-by-country/category manifest containing official endpoint, owner, rights for commercial extraction and redistribution, geographic scope, expected release cadence, freshness deadline, parser version, last successful read, independent publisher family, and current certification. A source is active only after rights and exact output have been reviewed.

| Category | Primary and independent fallback candidates | Collection policy |
| --- | --- | --- |
| Geopolitics | Country government and regulator notices, UN/IMO or other relevant intergovernmental releases; GDELT and licensed news can aid discovery but do not become independent official confirmation. | Poll official feeds at their allowed cadence; prioritize event-driven notices and recent active regions. Require independently attributable confirmation where the paid capability requires it. |
| Macro | National statistics agency and central bank releases; IMF, World Bank, OECD and ECB where coverage and publication rights fit. | Read release calendars and conditional HTTP responses; update on a new release, not every 15 minutes for unchanged series. |
| Critical minerals | National geological/mining authority and customs releases; USGS, BGS and UN Comtrade where their terms and country scope fit. | Prefer published release cadence, typically slower than realtime; treat trade, reserve and policy indicators as distinct measures, not interchangeable corroboration. |

Try the highest-ranked certified path, then a genuinely separate publisher family when stale, unavailable or insufficient. Preserve both provenances and disagreement instead of silently choosing the more convenient number. Deduplicate identical records by stable source record/version and content hash before raw storage. Cap per-source requests, new bytes, writes and backfill per day; a fallback does not remove commercial rights or freshness gates. If no qualified independent signal exists for the requested paid capability, return unavailable without a new charge. Adding free endpoints alone cannot turn the 96 currently fail-closed sovereign objects into paid-ready objects.

## GitHub-independent automation: execution choice

| Option | Fit for the current pipeline | Constraint |
| --- | --- | --- |
| OCI Always Free VM with systemd timer | Primary migration candidate: can run the existing Node 22, Bun 1.4.2 and Python 3.12 processes with frozen dependencies. | Capacity may be unavailable; idle instances may be reclaimed; no free uptime guarantee. Secure OS, disk, secrets and backups are our responsibility. |
| Cloudflare Worker Cron | Good independent heartbeat/watchdog and bounded HTTP dispatch after a protected endpoint is implemented. | Free CPU and request limits make it unsuitable for the current heavy subprocess pipeline; one Cron is not a substitute for compute. |
| Supabase pg_cron/Edge Functions | Useful for short, idempotent database-local jobs or a bounded recovery dispatch after refactoring. | Shares the already over-quota database and its pause/outage domain; not independent failover and not suitable for the existing multi-runtime pipeline as-is. |

Execution sequence:

1. Restore write headroom and run the read-only inventory first. Measure one week of task duration, memory, outbound bytes, source response rates and database growth. Size the VM and free-quota budget from these numbers; do not provision a production scheduler on a read-only database.
2. Remove GitHub-only authentication before migration. `scripts/run-rss-live-cycle.mjs` obtains `ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN`, and the orchestrator requests its OIDC audience. Give the RSS target a distinct short-lived workload credential and issuer validation, rotate its secrets, and test that GitHub-issued and VM-issued identities are scoped to their own audience. Audit every other task for GitHub environment assumptions and remove write access from the old identity at cutover.
3. Build a reproducible VM image or bootstrap with pinned runtimes and locked dependencies. Store secrets in a root-readable environment file or provider secret mechanism, never in the repository or command arguments. Restrict inbound access, outbound destinations and OS privileges. A systemd 15-minute timer launches a bounded one-shot process with timeout, resource limits and restart-on-next-tick behavior; logs are capped and secrets redacted.
4. Add an atomic, expiring shared lease for the entire heartbeat, including a fencing token on state writes, before running two environments. The current `live` cursor and local GitHub `concurrency` are not a cross-provider lock. Run the VM in dry-run or allowlisted shadow mode and compare task summaries, source freshness, byte usage and errors with GitHub for seven days. Avoid dual ingestion of the same source.
5. Cut over one task family at a time by disabling its GitHub schedule path and enabling its VM allowlist under the shared lease. Keep manual recovery dispatch, detect missed heartbeats externally (for example a tiny Cloudflare Cron watchdog), and page the owner. After a bounded missed-run window, any standby must acquire the same lease before execution; no automatic duplicate payment or ingestion writes.
6. Rehearse an unavailable VM, exhausted free quota, paused/read-only database, source rate limit, and settlement outage. Freeze new paid quotes if paid delivery cannot be completed and durably reconciled; keep already-settled request recovery and customer status available. Cutover finishes only after live coverage, reconciliation, restore and rollback gates pass.

Cloudflare Cron can call a narrowly authenticated health endpoint or send an alert without holding database service-role or signing keys. It cannot rescue a paused Supabase project by itself. If OCI capacity is unavailable, retain the current scheduler while implementing small, independently deployable worker tasks; do not silently claim a GitHub-free 24/7 service.

## Migration order and reversible gates

| Phase | Change | Evidence required before advancing |
| --- | --- | --- |
| 0 | Read-only inventory using `scripts/ops/free-tier-capacity.sql`; identify expiry and data age by source and bucket prefix. | Measured reclaimable bytes, table dependencies, backup and rollback plan. |
| 1 | Prune only expired `live_recent_fingerprints` in small batches; tune future TTL and polling volume. | No duplicate admission regression; database size and bloat measured after vacuum; no live coverage loss. |
| 2 | Add private external archive and a storage-location resolver while leaving Supabase copies intact. | Upload, checksum, readback, authorization, tamper test and restore test on staging. |
| 3 | Dual-read archived fragments and snapshots, then copy old objects in bounded batches. | Same canonical hashes and structuring outputs from both locations; source-rights and chain proofs unchanged. |
| 4 | Only after the old location is no longer referenced, remove verified old objects through Supabase Storage API; archive or compact eligible historical database payloads with approved retention. | No dangling references; payment/risk-object audits pass; measured DB below 350 MB and stable growth for at least 7 days. |
| 5 | Migrate scheduling task family by task family using the execution sequence above; configure site deployment and production payment provider/recipient; perform staging, then a single external production purchase and reconciliation. | Shared lease, identity isolation, shadow metrics, exact-head CI, live source/coverage, capacity, no-charge, settlement, refund/replay and rollback gates all pass. |

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
