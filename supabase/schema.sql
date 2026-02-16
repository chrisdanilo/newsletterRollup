-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  forwarding_address TEXT UNIQUE NOT NULL,
  digest_time TIME DEFAULT '21:00:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Newsletters table
CREATE TABLE public.newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  subject TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  summary TEXT,
  extracted_links JSONB DEFAULT '[]'::jsonb,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_id TEXT,
  included_in_digest BOOLEAN DEFAULT false,
  digest_sent_at TIMESTAMP WITH TIME ZONE
);

-- Blocked senders table
CREATE TABLE public.blocked_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sender_email)
);

-- Indexes for performance
CREATE INDEX newsletters_user_id_idx ON public.newsletters(user_id);
CREATE INDEX newsletters_received_at_idx ON public.newsletters(received_at);
CREATE INDEX newsletters_digest_idx ON public.newsletters(user_id, included_in_digest);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own newsletters" ON public.newsletters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own blocked senders" ON public.blocked_senders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert blocked senders" ON public.blocked_senders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete blocked senders" ON public.blocked_senders
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can insert newsletters (for webhook)
CREATE POLICY "Service role can insert newsletters" ON public.newsletters
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update newsletters" ON public.newsletters
  FOR UPDATE USING (true);

-- Service role can read profiles (for webhook lookup)
CREATE POLICY "Service role can read profiles" ON public.profiles
  FOR SELECT USING (true);
