-- Create games table for live multiplayer sessions
CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_set_id uuid NOT NULL REFERENCES public.flashcard_sets(id) ON DELETE CASCADE,
  game_code text NOT NULL UNIQUE,
  game_mode text NOT NULL CHECK (game_mode IN ('single', 'teams')),
  team_size integer DEFAULT 4,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed')),
  current_card_index integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Create game participants table
CREATE TABLE public.game_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  team_number integer,
  score integer DEFAULT 0,
  joined_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create game responses table to track answers
CREATE TABLE public.game_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.game_participants(id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL,
  response_time_ms integer,
  answered_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games
CREATE POLICY "Anyone can view active games"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "Hosts can create games"
  ON public.games FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update own games"
  ON public.games FOR UPDATE
  USING (auth.uid() = host_user_id);

CREATE POLICY "Hosts can delete own games"
  ON public.games FOR DELETE
  USING (auth.uid() = host_user_id);

-- RLS Policies for game_participants
CREATE POLICY "Anyone can view participants in games"
  ON public.game_participants FOR SELECT
  USING (true);

CREATE POLICY "Anyone can join games"
  ON public.game_participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own participant record"
  ON public.game_participants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Participants can leave games"
  ON public.game_participants FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for game_responses
CREATE POLICY "Anyone can view responses in their game"
  ON public.game_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_participants
      WHERE game_participants.game_id = game_responses.game_id
      AND game_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can create responses"
  ON public.game_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.game_participants
      WHERE game_participants.id = game_responses.participant_id
      AND game_participants.user_id = auth.uid()
    )
  );

-- Function to generate unique game code
CREATE OR REPLACE FUNCTION public.generate_game_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  code_exists boolean;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.games WHERE game_code = code AND status != 'completed') INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$$;

-- Enable realtime for live game updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_responses;