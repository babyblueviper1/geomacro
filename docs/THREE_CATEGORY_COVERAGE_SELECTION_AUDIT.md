# Three-category coverage selection audit (2026-09-27)

The curated `global-intelligence/sources/source-registry.v1.json` lists 17 geopolitics, 19 macro and 12 critical-minerals source families. These are source choices, not proof of live country observations. The production `live_external_sources` registry contains more granular candidates and must be inspected with `scripts/audit-source-certification-census.mjs` against the authoritative database for actual enablement and certification.

| Category | Existing primary paths | Existing fallback/cross-check | Added discovery candidate | Remaining selection issue |
| --- | --- | --- | --- | --- |
| GEOPOLITICS | UN Security Council, government, sanctions authorities, IMO/UKMTO | GDELT, verified Telegram discovery | U.S. State travel advisories | Advisory perspective and country mapping require certification; GDELT source country is a publisher attribute, not event location. |
| MACRO | National statistics/central banks, IMF, ECB, OECD, BIS, Eurostat | World Bank, UN Comtrade, UNCTAD, FAOSTAT | UN World Population Prospects 2024 | Demography is periodic structural context, not a fresh economic release. |
| CRITICAL_MINERALS | USGS, BGS, national mineral authorities, Australia, Chile, China | UN Comtrade, IEA/OECD/WTO policy and trade paths | UNEP IRP material flows | Aggregate metal ores cannot stand in for a named critical mineral or a current supply shock. |

The new entries in migration `981_three_category_source_candidates.sql` are disabled and rights-review gated. They must not increase live coverage counts or commercial readiness until endpoint, dataset scope, country attribution, usage rights, parser, freshness, provenance and independent source family have been checked in production.

The raw mesh worker now reads `discovery_state` for its freshness decision and leaves `last_success_at` unchanged when an HTTP 200 response contains no extractable evidence. This stops an empty page from satisfying the raw runtime audit. A successful raw snapshot still does not mean the live event engine or commercial risk object has usable evidence.

The Global Coverage Readiness Gate run 36295216955 refreshed 194 enabled sovereign objects; 98 were paid-ready and 96 failed closed. Its common embedded reason was insufficient country evidence. Adding registry candidates cannot repair that result. The next investigation is country-level event attribution, actual source ingestion and certification, followed by a fresh authoritative production audit. Do not lower the coverage threshold or count global pages as country-specific evidence.
