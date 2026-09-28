# Supabase platform log history on B2

The Free plan keeps Supabase API/database logs for one day. This private Edge Function copies each completed five-minute window **two hours after collection** to the existing private B2 bucket. It stores gzip-compressed NDJSON plus a SHA-256 proof and verifies both through the separate B2 read credential. The `read` action restores any archived window after Supabase's one-day retention expires.

This archives *history*. Supabase still ingests its own logs, so this does **not** lower the monthly Logs Ingest meter. It also does not delete platform logs. Reduce repetitive API calls and noisy application logging separately.

## Required secrets and deployment

Edge Function secrets, project `ldpwajisioljyjtojvfx`:

- `SUPABASE_LOGS_ACCESS_TOKEN`: a Supabase Management API token with `analytics_logs_read` permission for this project. The existing GitHub `SUPABASE_ACCESS_TOKEN` may have it, but GitHub secrets are not visible to Edge Functions. Enter the value in the Supabase dashboard, never in the repository or chat.
- `B2_ARCHIVE_WRITE_KEY_ID` and `B2_ARCHIVE_WRITE_APPLICATION_KEY`: bucket-scoped read/write credentials.
- `B2_ARCHIVE_READ_KEY_ID` and `B2_ARCHIVE_READ_APPLICATION_KEY`: separate read-only credentials.

Deploy `log-history-archive` with JWT verification **enabled**. The handler also requires the gateway-verified service-role JWT. No browser route or anonymous access.

First invoke manually with `{"action":"archive"}`, then inspect the JSON result. Read back its five-minute UTC `start` with `{"action":"read","start":"2026-09-28T02:00:00.000Z"}`, replacing the example with the returned value. Response is NDJSON. Check `cron.job_run_details` and the Edge error logs after scheduling.

To schedule at five-minute intervals, save the **service-role JWT** in Supabase Vault using SQL Editor, substituting the key in your own dashboard:

```sql
select vault.create_secret('<service-role JWT>', 'geomacro_log_archive_cron_jwt');
```

Then schedule (project URL is fixed, but the JWT is read from Vault at invocation time):

```sql
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule(
  'geomacro-log-history-to-b2-5min',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := 'https://ldpwajisioljyjtojvfx.supabase.co/functions/v1/log-history-archive',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'geomacro_log_archive_cron_jwt'
        )
      ),
      body := '{"action":"archive"}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);
```

The worker archives only one fixed window per invocation, fails closed if >3,000 rows or >16 MB JSON / 5 MB gzip, and allows manual backfill for individual five-minute UTC windows up to 20 hours old. A failed cron call must be retried while the original Supabase log window is still retained; inspect `net._http_response` for HTTP failures. This bounds each call, but there is no guarantee against a service outage lasting the full one-day retention.

These archives contain request data and may include IP addresses or query strings. Keep the bucket private. Configure a Backblaze lifecycle policy for the `geomacro-evidence/v1/logs/` prefix if you want finite B2 retention; otherwise B2's free quota will eventually fill. Do not set a lifecycle duration until your required retention is decided.

For permanent ingestion reduction, the 24-hour sample on 2026-09-28 showed 112,389 `edge_logs` events; top paths were `/rest/v1/live_structured_events` (19,669 successful reads), `live_external_sources` (12,325), and `geomacro_risk_objects` (11,744). Investigate repeated polling and redundant queries first.
