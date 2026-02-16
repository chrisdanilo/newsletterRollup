-- Add timezone support to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

-- Add message_id deduplication to newsletters
ALTER TABLE public.newsletters
  ADD COLUMN IF NOT EXISTS message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS newsletters_message_id_idx
  ON public.newsletters (user_id, message_id)
  WHERE message_id IS NOT NULL;

-- Track digest sends per user per day (prevents double-sends on cron retry)
CREATE TABLE IF NOT EXISTS public.digest_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  digest_date     DATE NOT NULL,
  newsletter_ids  UUID[] NOT NULL DEFAULT '{}',
  sent_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, digest_date)
);

ALTER TABLE public.digest_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own digest batches" ON public.digest_batches
  FOR SELECT USING (auth.uid() = user_id);

-- RLS rate limit: cap newsletters per user at 50 per 24-hour window
-- This is enforced at the database layer regardless of application code
CREATE OR REPLACE FUNCTION public.check_newsletter_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.newsletters
    WHERE user_id = NEW.user_id
      AND received_at > NOW() - INTERVAL '24 hours'
  ) >= 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 50 newsletters per 24 hours per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_newsletter_rate_limit ON public.newsletters;
CREATE TRIGGER enforce_newsletter_rate_limit
  BEFORE INSERT ON public.newsletters
  FOR EACH ROW EXECUTE FUNCTION public.check_newsletter_rate_limit();
