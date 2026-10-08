CREATE TABLE public.headlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair text NOT NULL,
  title text NOT NULL,
  description text,
  source text,
  url text NOT NULL,
  published_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pair, url)
);
CREATE INDEX headlines_pair_pub ON public.headlines(pair, published_at);
CREATE TABLE public.sentiments (
  headline_id uuid PRIMARY KEY REFERENCES public.headlines(id) ON DELETE CASCADE,
  pair text NOT NULL,
  label text NOT NULL CHECK (label IN ('bullish','bearish','neutral')),
  score double precision NOT NULL CHECK (score BETWEEN -1 AND 1),
  confidence double precision NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  relevance double precision NOT NULL CHECK (relevance BETWEEN 0 AND 1),
  reasoning text,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.prices (
  pair text NOT NULL,
  date date NOT NULL,
  close double precision NOT NULL,
  PRIMARY KEY (pair, date)
);
GRANT SELECT ON public.headlines, public.sentiments, public.prices TO anon, authenticated;
GRANT ALL ON public.headlines, public.sentiments, public.prices TO service_role;
ALTER TABLE public.headlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.headlines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.sentiments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.prices FOR SELECT TO anon, authenticated USING (true);