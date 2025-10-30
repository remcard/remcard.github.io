import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const JoinGame = () => {
  const navigate = useNavigate();
  const [gameCode, setGameCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gameCode.trim() || !displayName.trim()) {
      toast.error("Please enter both game code and name");
      return;
    }

    setIsJoining(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("id, status")
        .eq("game_code", gameCode.toUpperCase())
        .single();

      if (gameError || !gameData) {
        toast.error("Invalid game code");
        setIsJoining(false);
        return;
      }

      if (gameData.status !== "waiting") {
        toast.error("This game has already started");
        setIsJoining(false);
        return;
      }

      const { error: joinError } = await supabase
        .from("game_participants")
        .insert({
          game_id: gameData.id,
          user_id: user?.id,
          display_name: displayName,
        });

      if (joinError) throw joinError;

      toast.success("Joined game!");
      navigate(`/game/lobby/${gameData.id}`);
    } catch (error: any) {
      toast.error("Failed to join game");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="font-semibold text-lg">Join Game</h1>
            <div className="w-24" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-md">
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Join a Live Game</h2>
          <form onSubmit={handleJoinGame} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Game Code</label>
              <Input
                type="text"
                placeholder="Enter 6-character code"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-2xl tracking-widest uppercase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Your Name</label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary"
              disabled={isJoining}
            >
              {isJoining ? "Joining..." : "Join Game"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default JoinGame;
