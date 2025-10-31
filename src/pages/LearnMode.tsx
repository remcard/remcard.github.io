import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Check, X, Sparkles, Settings as SettingsIcon, Trophy, Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  image_url?: string;
  mastery_level?: number;
  last_studied?: Date;
}

interface LearnSettings {
  typingMode: boolean;
  showImages: boolean;
  difficulty: number;
  enableSpacedRepetition: boolean;
}

const LearnMode = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<LearnSettings>({
    typingMode: false,
    showImages: true,
    difficulty: 1,
    enableSpacedRepetition: true,
  });

  useEffect(() => {
    fetchSetAndCards();
  }, [id]);

  const fetchSetAndCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);

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

      // Fetch mastery levels if user is logged in
      if (user) {
        const { data: progressData } = await supabase
          .from("study_progress")
          .select("flashcard_id, mastery_level, last_studied_at")
          .eq("user_id", user.id)
          .in("flashcard_id", cardsData.map(c => c.id));

        const progressMap = new Map(
          progressData?.map(p => [
            p.flashcard_id,
            { mastery_level: p.mastery_level, last_studied: p.last_studied_at }
          ]) || []
        );

        const cardsWithProgress = cardsData.map(card => ({
          ...card,
          mastery_level: progressMap.get(card.id)?.mastery_level || 0,
          last_studied: progressMap.get(card.id)?.last_studied 
            ? new Date(progressMap.get(card.id)!.last_studied)
            : undefined
        }));

        // Sort by spaced repetition algorithm
        const sortedCards = settings.enableSpacedRepetition
          ? sortBySpacedRepetition(cardsWithProgress)
          : cardsWithProgress;

        setFlashcards(sortedCards);
      } else {
        setFlashcards(cardsData);
      }
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const sortBySpacedRepetition = (cards: Flashcard[]) => {
    return [...cards].sort((a, b) => {
      const now = new Date();
      
      // Priority 1: Never studied cards first
      if (!a.last_studied && b.last_studied) return -1;
      if (a.last_studied && !b.last_studied) return 1;
      
      // Priority 2: Lower mastery level
      if (a.mastery_level !== b.mastery_level) {
        return (a.mastery_level || 0) - (b.mastery_level || 0);
      }
      
      // Priority 3: Longest time since last study
      if (a.last_studied && b.last_studied) {
        return a.last_studied.getTime() - b.last_studied.getTime();
      }
      
      return 0;
    });
  };

  const updateMastery = async (flashcardId: string, wasCorrect: boolean) => {
    if (!userId) return;

    try {
      const { data: existingProgress } = await supabase
        .from("study_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("flashcard_id", flashcardId)
        .maybeSingle();

      const currentMastery = existingProgress?.mastery_level || 0;
      const newMastery = wasCorrect 
        ? Math.min(5, currentMastery + 1)
        : Math.max(0, currentMastery - 1);

      const timesReviewed = (existingProgress?.times_reviewed || 0) + 1;
      const timesCorrect = (existingProgress?.times_correct || 0) + (wasCorrect ? 1 : 0);

      if (existingProgress) {
        await supabase
          .from("study_progress")
          .update({
            mastery_level: newMastery,
            times_reviewed: timesReviewed,
            times_correct: timesCorrect,
            last_studied_at: new Date().toISOString(),
          })
          .eq("id", existingProgress.id);
      } else {
        await supabase
          .from("study_progress")
          .insert({
            user_id: userId,
            flashcard_id: flashcardId,
            mastery_level: newMastery,
            times_reviewed: 1,
            times_correct: wasCorrect ? 1 : 0,
            last_studied_at: new Date().toISOString(),
          });
      }
    } catch (error) {
      console.error("Failed to update mastery:", error);
    }
  };

  const handleAnswer = async (isCorrect: boolean) => {
    if (isCorrect) {
      setCorrectCount(correctCount + 1);
      setStreak(streak + 1);
      
      if (streak + 1 === 5) {
        toast.success("🔥 5 in a row! You're on fire!");
      } else if (streak + 1 === 10) {
        toast.success("🌟 10 streak! Unstoppable!");
      }
    } else {
      setStreak(0);
    }

    await updateMastery(currentCard.id, isCorrect);
    
    setTimeout(() => {
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
        setUserAnswer("");
      } else {
        const accuracy = ((correctCount + (isCorrect ? 1 : 0)) / flashcards.length * 100).toFixed(1);
        toast.success(`🎉 Complete! Score: ${correctCount + (isCorrect ? 1 : 0)}/${flashcards.length} (${accuracy}%)`);
        navigate("/");
      }
    }, 1000);
  };

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;
    setShowAnswer(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;
  const accuracy = currentIndex > 0 ? (correctCount / (currentIndex)) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <div className="text-center">
              <h1 className="font-semibold flex items-center gap-2 justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
                {setTitle} - Learn Mode
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  {correctCount} / {currentIndex + 1}
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="w-4 h-4" />
                  {streak} streak
                </span>
                <span>{accuracy.toFixed(0)}% accuracy</span>
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <SettingsIcon className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Learn Settings</DialogTitle>
                  <DialogDescription>Customize your learning experience</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="typing-mode">Typing Mode</Label>
                    <Switch
                      id="typing-mode"
                      checked={settings.typingMode}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, typingMode: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-images">Show Images</Label>
                    <Switch
                      id="show-images"
                      checked={settings.showImages}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, showImages: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="spaced-rep">Spaced Repetition</Label>
                    <Switch
                      id="spaced-rep"
                      checked={settings.enableSpacedRepetition}
                      onCheckedChange={(checked) => 
                        setSettings({ ...settings, enableSpacedRepetition: checked })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty: Level {settings.difficulty}</Label>
                    <Slider
                      value={[settings.difficulty]}
                      onValueChange={([value]) => 
                        setSettings({ ...settings, difficulty: value })
                      }
                      min={1}
                      max={3}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      {settings.difficulty === 1 && "Easier questions with hints"}
                      {settings.difficulty === 2 && "Standard difficulty"}
                      {settings.difficulty === 3 && "Challenging questions"}
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Card className="p-8 space-y-6 shadow-glow">
          <div className="text-center space-y-4">
            <div className="inline-block px-4 py-1 bg-primary/10 rounded-full text-sm font-medium">
              Mastery Level: {currentCard.mastery_level || 0}/5
            </div>
            <div className="text-sm text-muted-foreground">What is the definition?</div>
            <div className="text-3xl font-bold">{currentCard.term}</div>
            {settings.showImages && currentCard.image_url && (
              <img 
                src={currentCard.image_url} 
                alt={currentCard.term}
                className="max-w-md mx-auto rounded-lg shadow-md"
              />
            )}
          </div>

          {!settings.typingMode ? (
            <div className="space-y-3">
              {!showAnswer ? (
                <Button
                  onClick={() => setShowAnswer(true)}
                  className="w-full"
                  size="lg"
                >
                  Show Answer
                </Button>
              ) : (
                <>
                  <div className="p-6 bg-muted rounded-lg text-center border-2 border-primary/20">
                    <div className="text-lg font-medium">{currentCard.definition}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => handleAnswer(false)}
                      variant="outline"
                      size="lg"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Still Learning
                    </Button>
                    <Button
                      onClick={() => handleAnswer(true)}
                      size="lg"
                      className="bg-success hover:bg-success/90"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      Got It!
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Type your answer..."
                className="text-lg"
                disabled={showAnswer}
              />
              {!showAnswer ? (
                <Button onClick={handleSubmit} className="w-full" size="lg">
                  Submit
                </Button>
              ) : (
                <>
                  <div className={cn(
                    "p-4 rounded-lg text-center border-2",
                    userAnswer.toLowerCase().trim() === currentCard.definition.toLowerCase().trim()
                      ? "bg-success/20 text-success border-success/50"
                      : "bg-destructive/20 text-destructive border-destructive/50"
                  )}>
                    <div className="font-semibold mb-2">
                      {userAnswer.toLowerCase().trim() === currentCard.definition.toLowerCase().trim()
                        ? "✓ Correct!"
                        : "✗ Incorrect"}
                    </div>
                    <div className="text-sm">Correct answer: {currentCard.definition}</div>
                  </div>
                  <Button
                    onClick={() => handleAnswer(
                      userAnswer.toLowerCase().trim() === currentCard.definition.toLowerCase().trim()
                    )}
                    className="w-full"
                    size="lg"
                  >
                    Continue
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default LearnMode;
