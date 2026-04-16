-- ─────────────────────────────────────────────────────────────────────────────
-- Diagnostic helpers and a fix function for recurring event instances.
-- Run the SELECT queries in Supabase SQL Editor to diagnose, then call
-- fix_recurring_series() to delete wrong future instances and regenerate.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. View: inspect all recurring parents and their rules ───────────────────
-- Run this first to find the Bunco Girls event ID and see its recurrence rule:
--
--   SELECT id, title, starts_at::date AS original_date,
--          to_char(starts_at AT TIME ZONE 'America/Chicago', 'Dy') AS day_name,
--          recurrence_type, recurrence_rule
--   FROM events
--   WHERE is_recurring_parent = true
--   ORDER BY starts_at;

-- ── 2. View: inspect generated instances for a parent ────────────────────────
-- Replace <parent-id> with the UUID from step 1:
--
--   SELECT id, title, starts_at::date AS date,
--          to_char(starts_at AT TIME ZONE 'America/Chicago', 'Dy') AS day_name
--   FROM events
--   WHERE parent_event_id = '<parent-id>'
--   ORDER BY starts_at;

-- ── 3. fix_recurring_series(parent_id) ───────────────────────────────────────
-- Deletes all future instances of a series, then regenerates them correctly.
-- Usage: SELECT fix_recurring_series('<parent-event-id>');
CREATE OR REPLACE FUNCTION public.fix_recurring_series(_parent_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
  new_count     integer;
BEGIN
  -- Verify parent exists
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = _parent_id AND is_recurring_parent = true) THEN
    RETURN 'Error: no recurring parent event found with that ID';
  END IF;

  -- Delete all future instances (past ones are kept for history)
  DELETE FROM events
  WHERE  parent_event_id = _parent_id
    AND  starts_at >= now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Regenerate
  new_count := generate_recurring_instances();

  RETURN format('Deleted %s future instances, regenerated %s instances', deleted_count, new_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fix_recurring_series(uuid) TO authenticated;

-- ── 4. fix_recurring_rule(parent_id, dow, wom) ───────────────────────────────
-- If the recurrence_rule itself was saved wrong (e.g. wrong day_of_week),
-- call this to correct the rule on the parent before regenerating.
--
-- dow = 0 (Sun) through 6 (Sat).  Thursday = 4.
-- wom = 1 (first), 2 (second), etc.
--
-- Example — fix Bunco Girls to "first Thursday" then regenerate:
--   SELECT fix_recurring_rule('<parent-id>', 4, 1);
--   SELECT fix_recurring_series('<parent-id>');
CREATE OR REPLACE FUNCTION public.fix_recurring_rule(
  _parent_id uuid,
  _day_of_week integer,     -- 0=Sun … 6=Sat
  _week_of_month integer    -- 1=first, 2=second, etc.
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE events
  SET    recurrence_type = 'monthly_day_of_week',
         recurrence_rule = jsonb_build_object(
           'day_of_week',   _day_of_week,
           'week_of_month', _week_of_month
         )
  WHERE  id = _parent_id
    AND  is_recurring_parent = true;

  IF NOT FOUND THEN
    RETURN 'Error: parent event not found';
  END IF;

  RETURN format('Updated rule to first/nth-%s day-of-week=%s week=%s',
    _week_of_month, _day_of_week, _week_of_month);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fix_recurring_rule(uuid, integer, integer) TO authenticated;
