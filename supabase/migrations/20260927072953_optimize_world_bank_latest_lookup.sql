-- Optimize World Bank post-ingest latest-row lookups.
--
-- live_world_bank_indicator_latest uses DISTINCT ON (country_iso3, metric)
-- with this exact ordering and verified-commercial predicate. Keeping a small
-- partial index for only World Bank rows avoids a full-table scan + sort every
-- time the latest view is evaluated.

create index if not exists live_external_observations_world_bank_latest_idx
on public.live_external_observations (
  country_iso3,
  metric,
  observed_at desc nulls last,
  ingested_at desc,
  normalized_hash desc
)
where source_id = 'world_bank_indicators'
  and country_iso3 is not null
  and metric is not null
  and quality_status = 'VERIFIED'
  and commercial_eligibility_status = 'VERIFIED';

comment on index public.live_external_observations_world_bank_latest_idx is
  'Optimizes live_world_bank_indicator_latest DISTINCT ON ordering for commercially verified World Bank observations.';
