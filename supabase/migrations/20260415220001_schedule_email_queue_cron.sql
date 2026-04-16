-- Schedule pg_cron job to drain the email queue every 5 seconds.
--
-- This migration creates a setup helper function and attempts to run it.
-- The job reads its URL and service-role key from Supabase Vault at runtime,
-- so secrets are never stored in plaintext in cron.job.
--
-- REQUIRED vault secrets (set once via Supabase Dashboard → SQL Editor):
--   SELECT vault.create_secret('supabase_project_url',           'https://<project-ref>.supabase.co');
--   SELECT vault.create_secret('email_queue_service_role_key',   '<service_role_key>');
--
-- After setting them, activate the job:
--   SELECT public.setup_email_queue_cron();
--
-- To check status:  SELECT * FROM cron.job WHERE jobname = 'process-email-queue';
-- To remove job:    SELECT cron.unschedule('process-email-queue');

CREATE OR REPLACE FUNCTION public.setup_email_queue_cron()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url  text;
  v_key  text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN 'skipped: vault secrets (supabase_project_url, email_queue_service_role_key) not set';
  END IF;

  -- Remove existing job if present so we can replace it cleanly
  BEGIN
    PERFORM cron.unschedule('process-email-queue');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Schedule the job. Vault secrets are read at execution time, not stored here.
  PERFORM cron.schedule(
    'process-email-queue',
    '5 seconds',
    $cron$
    SELECT net.http_post(
      url     => (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_project_url'
        LIMIT 1
      ) || '/functions/v1/process-email-queue',
      body    => '{}'::jsonb,
      headers => jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'email_queue_service_role_key'
          LIMIT 1
        )
      )
    )
    $cron$
  );

  RETURN 'scheduled: process-email-queue (every 5 seconds)';
END;
$$;

-- Restrict to service_role so regular users cannot reschedule the job
REVOKE EXECUTE ON FUNCTION public.setup_email_queue_cron() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.setup_email_queue_cron() TO service_role;

-- Attempt to schedule immediately; silently skips if vault secrets aren't set yet
SELECT public.setup_email_queue_cron();
