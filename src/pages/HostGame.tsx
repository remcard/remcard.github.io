import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Users, Copy, Play } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Participant {
  id: string;
  display_name: string;
  team_number: number | null;
  joined_at: string;
}

const HostGame = () => {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [gameCode, setGameCode] = useState("");
  const [gameId, setGameId] = useState("");
  const [gameMode, setGameMode] = useState<"single" | "teams">("single");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [setTitle, setSetTitle] = useState("");

  useEffect(() => {
    initializeGame();
  }, [setId]);

  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game-${gameId}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const initializeGame = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("title")
        .eq("id", setId)
        .single();

      if (setError) throw setError;
      setSetTitle(setData.title);

      const { data: codeData, error: codeError } = await supabase
        .rpc("generate_game_code");

      if (codeError) throw codeError;

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .insert({
          host_user_id: user.id,
          flashcard_set_id: setId,
          game_code: codeData,
          game_mode: "single",
        })
        .select()
        .single();

      if (gameError) throw gameError;

      setGameCode(codeData);
      setGameId(gameData.id);
      fetchParticipants();
    } catch (error: any) {
      toast.error("Failed to create game");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchParticipants = async () => {
    if (!gameId) return;

    const { data, error } = await supabase
      .from("game_participants")
      .select("*")
      .eq("game_id", gameId)
      .order("joined_at");

    if (!error && data) {
      setParticipants(data);
    }
  };

  const handleGameModeChange = async (mode: "single" | "teams") => {
    setGameMode(mode);
    await supabase
      .from("games")
      .update({ game_mode: mode })
      .eq("id", gameId);

    if (mode === "teams") {
      assignTeams();
    }
  };

  const assignTeams = async () => {
    const teamSize = 4;
    const updates = participants.map((p, index) => ({
      id: p.id,
      team_number: Math.floor(index / teamSize) + 1,
    }));

    for (const update of updates) {
      await supabase
        .from("game_participants")
        .update({ team_number: update.team_number })
        .eq("id", update.id);
    }
    fetchParticipants();
  };

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameCode);
    toast.success("Game code copied!");
  };

  const startGame = async () => {
    if (participants.length === 0) {
      toast.error("Need at least one participant to start");
      return;
    }

    await supabase
      .from("games")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", gameId);

    navigate(`/game/play/${gameId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Setting up game...</p>
      </div>
    );
  }

  const teamGroups = participants.reduce((acc, p) => {
    if (gameMode === "teams" && p.team_number) {
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
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="font-semibold text-lg">Game Lobby</h1>
            <div className="w-24" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-2">{setTitle}</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">Game Code</p>
                <div className="flex items-center gap-2">
                  <code className="text-3xl font-bold tracking-wider bg-muted px-4 py-2 rounded">
                    {gameCode}
                  </code>
                  <Button size="icon" variant="outline" onClick={copyGameCode}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm font-medium mb-3">Game Mode</p>
              <RadioGroup value={gameMode} onValueChange={handleGameModeChange as any}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="single" />
                  <Label htmlFor="single">Single Player (Everyone for themselves)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="teams" id="teams" />
                  <Label htmlFor="teams">Teams of 4</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span className="font-medium">
                  {participants.length} Participant{participants.length !== 1 ? "s" : ""}
                </span>
              </div>
              <Button onClick={startGame} className="bg-gradient-primary">
                <Play className="w-4 h-4 mr-2" />
                Start Game
              </Button>
            </div>

            {gameMode === "single" ? (
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="p-3 bg-muted rounded flex items-center justify-between">
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
          </Card>
        </div>
      </main>
    </div>
  );
};

export default HostGame;
