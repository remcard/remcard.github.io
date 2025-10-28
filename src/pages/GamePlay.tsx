import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
}

interface Game {
  id: string;
  host_user_id: string;
  current_card_index: number;
  game_mode: string;
  flashcard_sets: {
    title: string;
  };
}

const GamePlay = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeGame();

    const channel = supabase
      .channel(`gameplay-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload: any) => {
          setGame(payload.new);
          if (payload.new.status === "completed") {
            navigate(`/game/results/${gameId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  useEffect(() => {
    if (game && flashcards.length > 0) {
      setCurrentCard(flashcards[game.current_card_index] || null);
    }
  }, [game?.current_card_index, flashcards]);

  const initializeGame = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*, flashcard_sets(title)")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;

      setGame(gameData as any);
      setIsHost(user?.id === gameData.host_user_id);

      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcards")
        .select("*")
        .eq("set_id", gameData.flashcard_set_id)
        .order("position");

      if (cardsError) throw cardsError;
      setFlashcards(cardsData);
    } catch (error) {
      toast.error("Failed to load game");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextCard = async () => {
    if (!game || !isHost) return;

    const nextIndex = game.current_card_index + 1;

    if (nextIndex >= flashcards.length) {
      await supabase
        .from("games")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", gameId);
      return;
    }

    await supabase
      .from("games")
      .update({ current_card_index: nextIndex })
      .eq("id", gameId);
  };

  if (isLoading || !currentCard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const progress = game ? ((game.current_card_index + 1) / flashcards.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ThemeSwitcher />
              {isHost && (
                <Button variant="ghost" onClick={() => navigate("/")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  End Game
                </Button>
              )}
            </div>
            <div className="text-center">
              <h1 className="font-semibold">{(game?.flashcard_sets as any)?.title}</h1>
              <p className="text-sm text-muted-foreground">
                Card {(game?.current_card_index || 0) + 1} / {flashcards.length}
              </p>
            </div>
            <div className="w-24" />
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="space-y-6">
          <Card className="p-8 min-h-[300px] flex flex-col items-center justify-center text-center">
            <div className="text-sm text-muted-foreground mb-4">TERM</div>
            <div className="text-3xl font-bold mb-8">{currentCard.term}</div>
            <div className="text-sm text-muted-foreground mb-4">DEFINITION</div>
            <div className="text-xl">{currentCard.definition}</div>
          </Card>

          {isHost && (
            <div className="flex justify-center">
              <Button
                onClick={handleNextCard}
                size="lg"
                className="bg-gradient-primary px-8"
              >
                {(game?.current_card_index || 0) < flashcards.length - 1
                  ? "Next Card"
                  : "Complete Game"}
              </Button>
            </div>
          )}

          {!isHost && (
            <p className="text-center text-muted-foreground">
              Waiting for host to advance...
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default GamePlay;
