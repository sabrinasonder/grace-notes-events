-- ─────────────────────────────────────────────────────────────────────────────
-- Add all columns that the frontend references but don't exist in the DB yet.
-- Every statement uses IF NOT EXISTS / OR REPLACE so this is safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. cover_image_position ───────────────────────────────────────────────────
-- Stores the CSS object-position value (e.g. "42.3% 60.0%") set by the
-- drag-to-reposition UI in CreateEvent.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_image_position TEXT DEFAULT '50% 50%';

-- ── 2. Recurring-events columns ───────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence_type       TEXT
    CHECK (recurrence_type IN (
      'weekly', 'biweekly', 'monthly_date', 'monthly_day_of_week'
    ));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence_rule       JSONB;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence_end_date   DATE;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS parent_event_id       UUID
    REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_recurring_parent   BOOLEAN NOT NULL DEFAULT false;

-- Index for quickly fetching instances of a parent event
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id
  ON public.events(parent_event_id);

CREATE INDEX IF NOT EXISTS idx_events_is_recurring_parent
  ON public.events(is_recurring_parent) WHERE is_recurring_parent = true;

-- ── 3. photo_save_notified_at ─────────────────────────────────────────────────
-- Used in Archive.tsx to track when the host last notified guests to save
-- their event photos.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS photo_save_notified_at TIMESTAMPTZ;

-- ── 4. event_hosts table ─────────────────────────────────────────────────────
-- Source of truth for all event hosts. Already in migration 040000 but may
-- not have been applied yet, so we guard with IF NOT EXISTS throughout.
CREATE TABLE IF NOT EXISTS public.event_hosts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES public.events(id)   ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'co-host'
                          CHECK (role IN ('creator', 'co-host')),
  added_by    UUID        REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_hosts_event_id ON public.event_hosts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_hosts_user_id  ON public.event_hosts(user_id);

-- Migrate existing hosts (no-op if already done)
INSERT INTO public.event_hosts (event_id, user_id, role, added_by)
SELECT id, host_id, 'creator', host_id
FROM   public.events
ON CONFLICT (event_id, user_id) DO NOTHING;

-- ── 5. RLS on event_hosts ─────────────────────────────────────────────────────
ALTER TABLE public.event_hosts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'event_hosts' AND policyname = 'event_hosts_select'
  ) THEN
    CREATE POLICY "event_hosts_select" ON public.event_hosts FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'event_hosts' AND policyname = 'event_hosts_insert'
  ) THEN
    CREATE POLICY "event_hosts_insert" ON public.event_hosts FOR INSERT
      WITH CHECK (
        auth.uid() IN (
          SELECT e.host_id FROM public.events e WHERE e.id = event_id
          UNION
          SELECT eh.user_id FROM public.event_hosts eh WHERE eh.event_id = event_id
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'event_hosts' AND policyname = 'event_hosts_delete'
  ) THEN
    CREATE POLICY "event_hosts_delete" ON public.event_hosts FOR DELETE
      USING (
        role != 'creator'
        AND auth.uid() IN (
          SELECT e.host_id FROM public.events e WHERE e.id = event_id
          UNION
          SELECT eh.user_id FROM public.event_hosts eh WHERE eh.event_id = event_id
        )
      );
  END IF;
END $$;

-- ── 6. Co-host UPDATE permissions on events ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'events' AND policyname = 'event_cohosts_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "event_cohosts_update" ON public.events
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM public.event_hosts
            WHERE event_hosts.event_id = events.id
              AND event_hosts.user_id   = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

-- ── 7. Co-host UPDATE permissions on rsvps ────────────────────────────────────
DROP POLICY IF EXISTS "host_can_update_rsvps" ON public.rsvps;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'rsvps' AND policyname = 'hosts_and_cohosts_update_rsvps'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "hosts_and_cohosts_update_rsvps" ON public.rsvps
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = rsvps.event_id
              AND (
                e.host_id = auth.uid()
                OR EXISTS (
                  SELECT 1 FROM public.event_hosts eh
                  WHERE eh.event_id = e.id AND eh.user_id = auth.uid()
                )
              )
          )
        )
    $policy$;
  END IF;
END $$;

-- ── 8. approve_rsvp_request — respect co-hosts ───────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_rsvp_request(
  _request_id uuid,
  _host_id    uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_user_id  uuid;
BEGIN
  SELECT event_id, user_id
  INTO   v_event_id, v_user_id
  FROM   rsvp_requests
  WHERE  id = _request_id AND status = 'pending';

  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM events     WHERE id = v_event_id AND host_id  = _host_id)
    OR
    EXISTS (SELECT 1 FROM event_hosts WHERE event_id = v_event_id AND user_id = _host_id)
  ) THEN
    RETURN false;
  END IF;

  UPDATE rsvp_requests
  SET    status     = 'approved',
         decided_by = _host_id,
         decided_at = now()
  WHERE  id = _request_id;

  INSERT INTO rsvps (event_id, user_id, status, paid)
  VALUES (v_event_id, v_user_id, 'going', false)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'going';

  RETURN true;
END;
$$;

-- ── 9. generate_recurring_instances ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_recurring_instances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_rec     RECORD;
  rtype          text;
  rule           jsonb;
  gen_date       date;
  new_event_id   uuid;
  instance_ts    timestamptz;
  time_offset    interval;
  horizon        date;
  series_end     date;
  dow_val        integer;
  interval_val   integer;
  dom_val        integer;
  wom_val        integer;
  first_of_month date;
  first_dow      date;
  nth_day        date;
  days_in_month  integer;
  target_day     date;
  cnt            integer := 0;
BEGIN
  horizon := (now() + interval '3 months')::date;

  FOR parent_rec IN
    SELECT * FROM events
    WHERE  is_recurring_parent = true
      AND  status = 'active'
      AND  (recurrence_end_date IS NULL OR recurrence_end_date > now()::date)
  LOOP
    rtype       := parent_rec.recurrence_type;
    rule        := parent_rec.recurrence_rule;
    series_end  := LEAST(COALESCE(parent_rec.recurrence_end_date, horizon), horizon);
    time_offset := parent_rec.starts_at - date_trunc('day', parent_rec.starts_at);

    IF rtype IN ('weekly', 'biweekly') THEN
      dow_val      := COALESCE((rule->>'day_of_week')::integer,
                               EXTRACT(DOW FROM parent_rec.starts_at)::integer);
      interval_val := CASE WHEN rule->>'interval' IS NOT NULL
                          THEN (rule->>'interval')::integer
                          WHEN rtype = 'biweekly' THEN 2 ELSE 1 END;
      gen_date := parent_rec.starts_at::date + (interval_val * 7);
      WHILE EXTRACT(DOW FROM gen_date) <> dow_val LOOP
        gen_date := gen_date + 1;
      END LOOP;
      WHILE gen_date <= series_end LOOP
        IF NOT EXISTS (
          SELECT 1 FROM events WHERE parent_event_id = parent_rec.id AND starts_at::date = gen_date
        ) THEN
          instance_ts := gen_date + time_offset;
          INSERT INTO events (
            host_id, title, description, location, starts_at,
            capacity, price_cents, auto_reminders_enabled, privacy,
            cover_image_url, cover_image_position, status,
            parent_event_id, recurrence_type, recurrence_rule, is_recurring_parent
          ) VALUES (
            parent_rec.host_id, parent_rec.title, parent_rec.description,
            parent_rec.location, instance_ts, parent_rec.capacity,
            parent_rec.price_cents, parent_rec.auto_reminders_enabled,
            parent_rec.privacy, parent_rec.cover_image_url,
            parent_rec.cover_image_position, 'active',
            parent_rec.id, parent_rec.recurrence_type, parent_rec.recurrence_rule, false
          ) RETURNING id INTO new_event_id;

          INSERT INTO event_hosts (event_id, user_id, role, added_by)
          SELECT new_event_id, user_id, role, added_by
          FROM   event_hosts WHERE event_id = parent_rec.id
          ON CONFLICT (event_id, user_id) DO NOTHING;

          cnt := cnt + 1;
        END IF;
        gen_date := gen_date + (interval_val * 7);
      END LOOP;

    ELSIF rtype = 'monthly_date' THEN
      dom_val  := COALESCE((rule->>'day_of_month')::integer,
                           EXTRACT(DAY FROM parent_rec.starts_at)::integer);
      gen_date := (date_trunc('month', parent_rec.starts_at) + interval '1 month')::date;
      WHILE gen_date <= series_end LOOP
        days_in_month := EXTRACT(DAY FROM
          (date_trunc('month', gen_date) + interval '1 month' - interval '1 day'))::integer;
        target_day := (date_trunc('month', gen_date)::date
                      + (LEAST(dom_val, days_in_month) - 1) * interval '1 day')::date;
        IF target_day <= series_end THEN
          IF NOT EXISTS (
            SELECT 1 FROM events WHERE parent_event_id = parent_rec.id AND starts_at::date = target_day
          ) THEN
            instance_ts := target_day + time_offset;
            INSERT INTO events (
              host_id, title, description, location, starts_at,
              capacity, price_cents, auto_reminders_enabled, privacy,
              cover_image_url, cover_image_position, status,
              parent_event_id, recurrence_type, recurrence_rule, is_recurring_parent
            ) VALUES (
              parent_rec.host_id, parent_rec.title, parent_rec.description,
              parent_rec.location, instance_ts, parent_rec.capacity,
              parent_rec.price_cents, parent_rec.auto_reminders_enabled,
              parent_rec.privacy, parent_rec.cover_image_url,
              parent_rec.cover_image_position, 'active',
              parent_rec.id, parent_rec.recurrence_type, parent_rec.recurrence_rule, false
            ) RETURNING id INTO new_event_id;

            INSERT INTO event_hosts (event_id, user_id, role, added_by)
            SELECT new_event_id, user_id, role, added_by
            FROM   event_hosts WHERE event_id = parent_rec.id
            ON CONFLICT (event_id, user_id) DO NOTHING;

            cnt := cnt + 1;
          END IF;
        END IF;
        gen_date := (date_trunc('month', gen_date) + interval '1 month')::date;
      END LOOP;

    ELSIF rtype = 'monthly_day_of_week' THEN
      dow_val  := COALESCE((rule->>'day_of_week')::integer,
                           EXTRACT(DOW FROM parent_rec.starts_at)::integer);
      wom_val  := COALESCE((rule->>'week_of_month')::integer, 1);
      gen_date := (date_trunc('month', parent_rec.starts_at) + interval '1 month')::date;
      WHILE gen_date <= series_end LOOP
        first_of_month := date_trunc('month', gen_date)::date;
        first_dow := first_of_month;
        WHILE EXTRACT(DOW FROM first_dow) <> dow_val LOOP
          first_dow := first_dow + 1;
        END LOOP;
        nth_day := (first_dow + ((wom_val - 1) * 7) * interval '1 day')::date;
        IF EXTRACT(MONTH FROM nth_day) = EXTRACT(MONTH FROM first_of_month)
           AND nth_day <= series_end THEN
          IF NOT EXISTS (
            SELECT 1 FROM events WHERE parent_event_id = parent_rec.id AND starts_at::date = nth_day
          ) THEN
            instance_ts := nth_day + time_offset;
            INSERT INTO events (
              host_id, title, description, location, starts_at,
              capacity, price_cents, auto_reminders_enabled, privacy,
              cover_image_url, cover_image_position, status,
              parent_event_id, recurrence_type, recurrence_rule, is_recurring_parent
            ) VALUES (
              parent_rec.host_id, parent_rec.title, parent_rec.description,
              parent_rec.location, instance_ts, parent_rec.capacity,
              parent_rec.price_cents, parent_rec.auto_reminders_enabled,
              parent_rec.privacy, parent_rec.cover_image_url,
              parent_rec.cover_image_position, 'active',
              parent_rec.id, parent_rec.recurrence_type, parent_rec.recurrence_rule, false
            ) RETURNING id INTO new_event_id;

            INSERT INTO event_hosts (event_id, user_id, role, added_by)
            SELECT new_event_id, user_id, role, added_by
            FROM   event_hosts WHERE event_id = parent_rec.id
            ON CONFLICT (event_id, user_id) DO NOTHING;

            cnt := cnt + 1;
          END IF;
        END IF;
        gen_date := (date_trunc('month', gen_date) + interval '1 month')::date;
      END LOOP;
    END IF;
  END LOOP;

  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_recurring_instances() TO authenticated;
