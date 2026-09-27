-- Read-only capacity inventory for the authoritative Supabase SQL Editor.
-- Run each result set separately if the editor displays only the last one.
-- Estimates from pg_stat_user_tables are diagnostic, not exact row counts.

select pg_size_pretty(pg_database_size(current_database())) as database_size;

select n.nspname as schema_name, c.relname as relation_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
       pg_size_pretty(pg_relation_size(c.oid)) as heap_size,
       pg_size_pretty(pg_indexes_size(c.oid)) as index_size,
       coalesce(s.n_live_tup, 0) as estimated_rows,
       coalesce(s.n_dead_tup, 0) as estimated_dead_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where c.relkind in ('r', 'm')
  and n.nspname not in ('pg_catalog', 'information_schema')
order by pg_total_relation_size(c.oid) desc
limit 25;

select count(*) as expired_fingerprint_rows,
       count(*) filter (where expires_at >= now()) as unexpired_fingerprint_rows,
       min(expires_at) as oldest_expiry
from public.live_recent_fingerprints;

select source_id, category, count(*) as rows,
       pg_size_pretty(sum(pg_column_size(raw_payload))::bigint) as raw_payload_bytes,
       min(ingested_at) as earliest_ingest,
       max(ingested_at) as latest_ingest
from public.live_external_observations
group by source_id, category
order by sum(pg_column_size(raw_payload)) desc nulls last
limit 20;

select bucket_id, split_part(name, '/', 1) as prefix,
       count(*) as objects, min(created_at) as oldest_object,
       max(created_at) as newest_object
from storage.objects
group by bucket_id, split_part(name, '/', 1)
order by count(*) desc
limit 25;
