-- Add recurrence columns to the events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT 'none'
    CHECK (recurrence_type IN ('none', 'weekly', 'biweekly', 'monthly_day_of_week', 'monthly_date', 'custom')),
  ADD COLUMN IF NOT EXISTS recurrence_rule jsonb,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_recurring_parent boolean NOT NULL DEFAULT false;

-- Efficient lookups: all instances of a parent, all active parents
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id
  ON events(parent_event_id) WHERE parent_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_recurring_parents
  ON events(id) WHERE is_recurring_parent = true AND status = 'active';

-- ──────────────────────────────────────────────────────────────────────────
-- generate_recurring_instances()
-- Looks at every active recurring parent and inserts any missing instances
-- up to 3 months out. Safe to call repeatedly — skips existing dates.
-- Returns the number of new instances created.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_recurring_instances()
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
    WHERE is_recurring_parent = true
      AND status = 'active'
      AND (recurrence_end_date IS NULL OR recurrence_end_date > now()::date)
  LOOP
    rtype      := parent_rec.recurrence_type;
    rule       := parent_rec.recurrence_rule;
    series_end := LEAST(COALESCE(parent_rec.recurrence_end_date, horizon), horizon);
    -- Preserve the time-of-day from the parent event
    time_offset := parent_rec.starts_at - date_trunc('day', parent_rec.starts_at);

    -- ── WEEKLY / BIWEEKLY ────────────────────────────────────────────────
    IF rtype IN ('weekly', 'biweekly') THEN
      dow_val      := COALESCE((rule->>'day_of_week')::integer,
                               EXTRACT(DOW FROM parent_rec.starts_at)::integer);
      interval_val := CASE WHEN rule->>'interval' IS NOT NULL
                          THEN (rule->>'interval')::integer
                          WHEN rtype = 'biweekly' THEN 2
                          ELSE 1 END;

      -- Start from parent date + one interval
      gen_date := parent_rec.starts_at::date + (interval_val * 7);
      -- Align to the correct day-of-week (should already be aligned, but be safe)
      WHILE EXTRACT(DOW FROM gen_date) <> dow_val LOOP
        gen_date := gen_date + 1;
      END LOOP;

      WHILE gen_date <= series_end LOOP
        IF NOT EXISTS (
          SELECT 1 FROM events
          WHERE parent_event_id = parent_rec.id AND starts_at::date = gen_date
        ) THEN
          instance_ts := gen_date + time_offset;
          INSERT INTO events (
            host_id, title, description, location, starts_at,
            capacity, price_cents, auto_reminders_enabled, privacy,
            cover_image_url, status,
            parent_event_id, recurrence_type, recurrence_rule, is_recurring_parent
          ) VALUES (
            parent_rec.host_id, parent_rec.title, parent_rec.description,
            parent_rec.location, instance_ts,
            parent_rec.capacity, parent_rec.price_cents,
            parent_rec.auto_reminders_enabled, parent_rec.privacy,
            parent_rec.cover_image_url, 'active',
            parent_rec.id, parent_rec.recurrence_type,
            parent_rec.recurrence_rule, false
          );
          cnt := cnt + 1;
        END IF;
        gen_date := gen_date + (interval_val * 7);
      END LOOP;

    -- ── MONTHLY — SAME DATE (e.g. 15th of every month) ──────────────────
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
            SELECT 1 FROM events
            WHERE parent_event_id = parent_rec.id AND starts_at::date = target_day
          ) THEN
            instance_ts := target_day + time_offset;
            INSERT INTO events (
              host_id, title, description, location, starts_at,
              capacity, price_cents, auto_reminders_enabled, privacy,
              cover_image_url, status,
              parent_event_id, recurrence_type, recurrence_rule, is_recurring_parent
            ) VALUES (
              parent_rec.host_id, parent_rec.title, parent_rec.description,
              parent_rec.location, instance_ts,
              parent_rec.capacity, parent_rec.price_cents,
              parent_rec.auto_reminders_enabled, parent_rec.privacy,
              parent_rec.cover_image_url, 'active',
              parent_rec.id, parent_rec.recurrence_type,
              parent_rec.recurrence_rule, false
            );
            cnt := cnt + 1;
          END IF;
        END IF;
        gen_date := (date_trunc('month', gen_date) + interval '1 month')::date;
      END LOOP;

    -- ── MONTHLY — SAME DAY OF WEEK (e.g. first Thursday) ────────────────
    ELSIF rtype = 'monthly_day_of_week' THEN
      dow_val  := COALESCE((rule->>'day_of_week')::integer,
                           EXTRACT(DOW FROM parent_rec.starts_at)::integer);
      wom_val  := COALESCE((rule->>'week_of_month')::integer, 1);
      gen_date := (date_trunc('month', parent_rec.starts_at) + interval '1 month')::date;

      WHILE gen_date <= series_end LOOP
        first_of_month := date_trunc('month', gen_date)::date;
        -- Find first occurrence of target dow in this month
        first_dow := first_of_month;
        WHILE EXTRACT(DOW FROM first_dow) <> dow_val LOOP
          first_dow := first_dow + 1;
        END LOOP;
        -- Advance to the nth occurrence
        nth_day := (first_dow + ((wom_val - 1) * 7) * interval '1 day')::date;

        -- Verify nth_day is still in the same month (handles "5th Thursday" in short months)
        IF EXTRACT(MONTH FROM nth_day) = EXTRACT(MONTH FROM first_of_month)
           AND nth_day <= series_end THEN
          IF NOT EXISTS (
            SELECT 1 FROM events
            WHERE parent_event_id = parent_rec.id AND starts_at::date = nth_day
          ) THEN
            instance_ts := nth_day + time_offset;
            INSERT INTO events (
              host_id, title, description, location, starts_at,
              capacity, price_cents, auto_reminders_enabled, privacy,
              cover_image_url, status,
              parent_event_id, recurrence_type, recurrence_rule, is_recurring_parent
            ) VALUES (
              parent_rec.host_id, parent_rec.title, parent_rec.description,
              parent_rec.location, instance_ts,
              parent_rec.capacity, parent_rec.price_cents,
              parent_rec.auto_reminders_enabled, parent_rec.privacy,
              parent_rec.cover_image_url, 'active',
              parent_rec.id, parent_rec.recurrence_type,
              parent_rec.recurrence_rule, false
            );
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

-- Let authenticated users trigger instance generation
GRANT EXECUTE ON FUNCTION generate_recurring_instances() TO authenticated;
