import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RotateCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ThemeSwitcher from "@/components/ThemeSwitcher";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
}

const Study = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSetAndCards();
  }, [id]);

  const fetchSetAndCards = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("title")
        .eq("id", id)
        .maybeSingle();

      if (setError) throw setError;
      if (!setData) {
        toast.error("Set not found");
        navigate("/");
        return;
      }
      
      setSetTitle(setData.title);

      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcards")
        .select("*")
        .eq("set_id", id)
        .order("position");

      if (cardsError) throw cardsError;

      if (cardsData.length === 0) {
        toast.error("This set has no flashcards");
        navigate("/");
        return;
      }

      setFlashcards(cardsData);
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      toast.success("You've completed this set!");
      navigate("/");
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading flashcards...</p>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ThemeSwitcher />
              <Button variant="ghost" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exit
              </Button>
            </div>
            <div className="text-center">
              <h1 className="font-semibold">{setTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {currentIndex + 1} / {flashcards.length}
              </p>
            </div>
            <Button variant="ghost" onClick={handleRestart}>
              <RotateCw className="w-4 h-4 mr-2" />
              Restart
            </Button>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="space-y-6">
          <div
            className="perspective-1000 cursor-pointer"
            onClick={handleFlip}
          >
            <Card
              className={cn(
                "relative min-h-[400px] p-8 flex items-center justify-center transition-all duration-500 transform-style-preserve-3d shadow-glow",
                isFlipped && "rotate-y-180"
              )}
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              <div
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center p-8 backface-hidden",
                  isFlipped && "invisible"
                )}
              >
                <div className="text-sm text-muted-foreground mb-4">TERM</div>
                <div className="text-3xl font-bold text-center">{currentCard.term}</div>
                <div className="mt-8 text-sm text-muted-foreground">
                  Click to flip
                </div>
              </div>
              <div
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center p-8 backface-hidden",
                  !isFlipped && "invisible"
                )}
                style={{
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="text-sm text-muted-foreground mb-4">DEFINITION</div>
                <div className="text-2xl text-center">{currentCard.definition}</div>
              </div>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleNext}
              size="lg"
              className="bg-gradient-primary hover:opacity-90 transition-opacity px-8"
            >
              {currentIndex < flashcards.length - 1 ? (
                <>
                  Next Card
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              ) : (
                "Complete"
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Study;
