import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Users } from "lucide-react";

interface Participant {
  id: string;
  display_name: string;
  team_number: number | null;
}

interface Game {
  id: string;
  game_code: string;
  game_mode: string;
  status: string;
  flashcard_sets: {
    title: string;
  };
}

const GameLobby = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGameData();

    const channel = supabase
      .channel(`game-lobby-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_participants",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          fetchParticipants();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload: any) => {
          if (payload.new.status === "in_progress") {
            navigate(`/game/play/${gameId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const fetchGameData = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*, flashcard_sets(title)")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      setGame(gameData as any);

      fetchParticipants();
    } catch (error) {
      toast.error("Failed to load game");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchParticipants = async () => {
    const { data, error } = await supabase
      .from("game_participants")
      .select("*")
      .eq("game_id", gameId)
      .order("joined_at");

    if (!error && data) {
      setParticipants(data);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!game) return null;

  const teamGroups = participants.reduce((acc, p) => {
    if (game.game_mode === "teams" && p.team_number) {
      if (!acc[p.team_number]) acc[p.team_number] = [];
      acc[p.team_number].push(p);
    }
    return acc;
  }, {} as Record<number, Participant[]>);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="w-24" />
            <h1 className="font-semibold text-lg">Waiting for Host</h1>
            <div className="w-24" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-2">{(game.flashcard_sets as any).title}</h2>
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-2">Game Code</p>
              <code className="text-3xl font-bold tracking-wider bg-muted px-4 py-2 rounded inline-block">
                {game.game_code}
              </code>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" />
              <span className="font-medium">
                {participants.length} Participant{participants.length !== 1 ? "s" : ""}
              </span>
            </div>

            {game.game_mode === "single" ? (
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="p-3 bg-muted rounded">
                    <span className="font-medium">{p.display_name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(teamGroups).map(([teamNum, members]) => (
                  <div key={teamNum} className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Team {teamNum}</h3>
                    <div className="space-y-2">
                      {members.map((p) => (
                        <div key={p.id} className="p-2 bg-muted rounded">
                          <span>{p.display_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-center text-muted-foreground mt-6 animate-pulse">
              Waiting for host to start the game...
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default GameLobby;
