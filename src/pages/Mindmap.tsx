import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Network } from "lucide-react";
import { toast } from "sonner";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
}

const Mindmap = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const { data: setData } = await supabase
        .from("flashcard_sets")
        .select("title")
        .eq("id", id)
        .single();

      if (setData) setSetTitle(setData.title);

      const { data: cardsData } = await supabase
        .from("flashcards")
        .select("id, term, definition")
        .eq("set_id", id)
        .limit(20);

      if (cardsData) setFlashcards(cardsData);
    } catch (error) {
      toast.error("Failed to load mindmap data");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading mindmap...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="font-semibold">{setTitle} - Mindmap</h1>
            <div></div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 text-center">
          <Network className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Concept Mindmap</h2>
          <p className="text-muted-foreground">
            Visual representation of relationships between concepts
          </p>
        </div>

        <Card className="p-8">
          <div className="relative min-h-[600px] flex items-center justify-center">
            {/* Central Node */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="bg-gradient-primary text-white px-6 py-4 rounded-lg shadow-glow">
                <div className="font-bold text-lg text-center">{setTitle}</div>
              </div>
            </div>

            {/* Concept Nodes in a circle */}
            {flashcards.map((card, index) => {
              const angle = (index * 360) / flashcards.length;
              const radius = 250;
              const x = Math.cos((angle * Math.PI) / 180) * radius;
              const y = Math.sin((angle * Math.PI) / 180) * radius;

              return (
                <div
                  key={card.id}
                  className="absolute top-1/2 left-1/2 transition-all hover:scale-110"
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                >
                  {/* Connection Line */}
                  <svg
                    className="absolute top-1/2 left-1/2 pointer-events-none"
                    style={{
                      width: Math.abs(x) + 50,
                      height: Math.abs(y) + 50,
                      transform: `translate(-50%, -50%)`,
                    }}
                  >
                    <line
                      x1={x > 0 ? 0 : Math.abs(x)}
                      y1={y > 0 ? 0 : Math.abs(y)}
                      x2={x > 0 ? Math.abs(x) : 0}
                      y2={y > 0 ? Math.abs(y) : 0}
                      stroke="hsl(var(--border))"
                      strokeWidth="2"
                      opacity="0.3"
                    />
                  </svg>

                  <div className="bg-card border-2 border-primary/30 px-4 py-3 rounded-lg shadow-md min-w-[120px] max-w-[200px] hover:border-primary hover:shadow-lg transition-all cursor-pointer">
                    <div className="font-semibold text-sm text-center truncate">
                      {card.term}
                    </div>
                    <div className="text-xs text-muted-foreground text-center mt-1 line-clamp-2">
                      {card.definition}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Hover over nodes to see details. Lines show relationships between concepts and the main topic.</p>
        </div>
      </main>
    </div>
  );
};

export default Mindmap;
