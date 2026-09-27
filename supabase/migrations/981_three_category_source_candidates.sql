begin;

-- These are independently published official discovery/structural paths.
-- Registration does not imply country coverage, current events, commercial
-- redistribution rights, a working adapter, or production certification.
insert into public.live_external_sources
  (source_id, source_name, provider_name, category, access_type,
   authentication_type, base_url, licence_name, commercial_usage_status,
   raw_redistribution_allowed, attribution_required, enabled_for_ingestion,
   enabled_for_commercial_signals, country_scope, freshness_class, notes)
values
  ('us_state_travel_advisories', 'U.S. State Department Travel Advisories',
   'U.S. Department of State', 'GEOPOLITICS', 'HTML', 'NONE',
   'https://travel.state.gov/en/international-travel.html', null,
   'REVIEW_REQUIRED', false, true, false, false, 'GLOBAL', 'PERIODIC',
   'Official country advisory discovery surface. U.S. traveler safety perspective; country mapping, update timestamps, terms and collector require certification.'),
  ('un_wpp_2024', 'UN World Population Prospects 2024',
   'United Nations Population Division', 'MACRO', 'BULK_DOWNLOAD', 'NONE',
   'https://population.un.org/wpp/', null,
   'REVIEW_REQUIRED', false, true, false, false, 'GLOBAL', 'PERIODIC',
   'Official demographic baseline and projections. Version and country mapping must be preserved; not a realtime macro signal.'),
  ('unep_irp_material_flows', 'UNEP IRP Global Material Flows Database',
   'United Nations Environment Programme', 'CRITICAL_MINERALS', 'BULK_DOWNLOAD', 'NONE',
   'https://www.unep.org/explore-topics/resource-efficiency/what-we-do/international-resource-panel', null,
   'REVIEW_REQUIRED', false, true, false, false, 'GLOBAL', 'PERIODIC',
   'Independent aggregate metal-ore extraction/material-use context. Does not identify individual critical-mineral supply or qualify as a current shock feed; dataset, rights and adapter require review.')
on conflict (source_id) do nothing;

commit;
