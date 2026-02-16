-- Replace the ambiguous nullable `summary` field with an explicit status column.
-- pending  = just inserted, summarization not yet attempted
-- done     = Claude returned a summary successfully
-- failed   = Claude call failed; summary column holds the fallback text if any

ALTER TABLE public.newsletters
  ADD COLUMN IF NOT EXISTS summarization_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (summarization_status IN ('pending', 'done', 'failed'));

-- Back-fill existing rows: anything with a real summary is 'done',
-- anything that contains the '(Summary unavailable)' sentinel is 'failed',
-- anything still null is 'pending'.
UPDATE public.newsletters
  SET summarization_status = CASE
    WHEN summary IS NULL THEN 'pending'
    WHEN summary LIKE '%(Summary unavailable)' THEN 'failed'
    ELSE 'done'
  END;
