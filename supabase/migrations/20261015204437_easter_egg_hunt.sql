-- The 2027 Easter Bunny hunt is account-bound, resumable and claimable once.
-- Rewards are applied together with the private discount code in one function
-- transaction so retries cannot duplicate stamps, points or draw entries.
CREATE TABLE IF NOT EXISTS public.easter_hunt_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  tap_count INTEGER NOT NULL DEFAULT 0 CHECK (tap_count BETWEEN 0 AND 75),
  last_tap_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  discount_code TEXT,
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE public.easter_hunt_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.easter_hunt_progress FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_easter_hunt_progress(p_event_id TEXT)
RETURNS TABLE (tap_count INTEGER, completed BOOLEAN, discount_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_event TEXT := COALESCE(NULLIF(p_event_id, ''), 'easter-hunt-2027');
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = v_uid::TEXT AND p.role = 'customer'
  ) THEN
    RAISE EXCEPTION 'A signed-in customer account is required.' USING ERRCODE = '42501';
  END IF;
  IF v_event <> 'easter-hunt-2027' THEN
    RAISE EXCEPTION 'This Easter hunt is not active.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT COALESCE(h.tap_count, 0), h.completed_at IS NOT NULL, h.discount_code
      FROM (SELECT 1) AS seed
      LEFT JOIN public.easter_hunt_progress AS h ON h.user_id = v_uid AND h.event_id = v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.get_easter_hunt_progress(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_easter_hunt_progress(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.tap_easter_bunny(p_event_id TEXT)
RETURNS TABLE (tap_count INTEGER, completed BOOLEAN, discount_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_event TEXT := COALESCE(NULLIF(p_event_id, ''), 'easter-hunt-2027');
  v_count INTEGER;
  v_last_tap TIMESTAMPTZ;
  v_completed TIMESTAMPTZ;
  v_code TEXT;
  v_name TEXT;
  v_stamps_before INTEGER;
  v_stamps_after INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to join the Easter hunt.' USING ERRCODE = '28000';
  END IF;
  IF v_event <> 'easter-hunt-2027' THEN
    RAISE EXCEPTION 'This Easter hunt is not active.' USING ERRCODE = '22023';
  END IF;

  SELECT p.display_name, COALESCE(p.stamps, 0)
    INTO v_name, v_stamps_before
    FROM public.profiles AS p
   WHERE p.id = v_uid::TEXT AND p.role = 'customer'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A customer loyalty profile is required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.easter_hunt_progress (user_id, event_id)
  VALUES (v_uid, v_event)
  ON CONFLICT (user_id, event_id) DO NOTHING;

  SELECT h.tap_count, h.last_tap_at, h.completed_at, h.discount_code
    INTO v_count, v_last_tap, v_completed, v_code
    FROM public.easter_hunt_progress AS h
   WHERE h.user_id = v_uid AND h.event_id = v_event
   FOR UPDATE;

  IF v_completed IS NULL THEN
    v_count := LEAST(75, v_count + 1);
    UPDATE public.easter_hunt_progress
       SET tap_count = v_count, last_tap_at = now()
     WHERE user_id = v_uid AND event_id = v_event;

    IF v_count = 75 THEN
      v_code := 'EASTER-' || upper(right(replace(v_uid::TEXT, '-', ''), 8));
      v_stamps_after := v_stamps_before + 1;

      UPDATE public.profiles
         SET stamps = v_stamps_after,
             merit_points = COALESCE(merit_points, 0) + 50,
             completed_cards = COALESCE(completed_cards, 0) + 2,
             updated_at = now()
       WHERE id = v_uid::TEXT;

      INSERT INTO public.stamp_logs
        (id, customer_id, customer_name, staff_id, staff_name, action, stamps_before, stamps_after, note, user_id, timestamp)
      VALUES
        ('easter-hunt-2027-' || v_uid::TEXT, v_uid::TEXT, COALESCE(v_name, 'Customer'), NULL,
         'Easter Egg Hunt', 'add_stamp', v_stamps_before, v_stamps_after,
         'Easter Bunny hunt completed: 1 loyalty stamp, 50 points, 2 prize draw entries and personal £5 code.',
         v_uid, now());

      INSERT INTO public.discount_codes
        (id, code, title, description, type, value, status, expires_at, usage_limit, times_used,
         assigned_to_uid, assigned_to_name, eligible_categories, minimum_spend, audience, created_by, created_at, updated_at)
      VALUES
        ('easter-hunt-2027-' || v_uid::TEXT, v_code, 'Easter Egg Hunt Reward',
         '£5 off for finding the Easter Bunny. One use, for the winning loyalty member.',
         'fixed', 5, 'active', now() + interval '90 days', 1, 0,
         v_uid::TEXT, COALESCE(v_name, 'Customer'), '[]'::jsonb, NULL, 'member', 'easter-egg-hunt', now(), now());

      UPDATE public.easter_hunt_progress
         SET completed_at = now(), discount_code = v_code
       WHERE user_id = v_uid AND event_id = v_event;
      v_completed := now();
    END IF;
  END IF;

  RETURN QUERY SELECT v_count, v_completed IS NOT NULL, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.tap_easter_bunny(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tap_easter_bunny(TEXT) TO authenticated;
