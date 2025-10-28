-- Create matching_game_results table for leaderboard
CREATE TABLE public.matching_game_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flashcard_set_id uuid NOT NULL REFERENCES public.flashcard_sets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  player_name text NOT NULL,
  completion_time_ms integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.matching_game_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view matching results"
  ON public.matching_game_results FOR SELECT
  USING (true);

CREATE POLICY "Users can create own results"
  ON public.matching_game_results FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Create index for faster leaderboard queries
CREATE INDEX idx_matching_results_set_time 
  ON public.matching_game_results(flashcard_set_id, completion_time_ms);