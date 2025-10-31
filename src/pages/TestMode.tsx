import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Sparkles, Settings as SettingsIcon, Trophy, Clock, Target } from "lucide-react";
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
}

interface Question {
  question: string;
  options?: string[];
  correctAnswer: string | boolean;
  explanation: string;
  type: "multiple_choice" | "true_false" | "fill_blank";
}

interface TestSettings {
  questionCount: number;
  questionType: "mixed" | "multiple_choice" | "true_false" | "fill_blank";
  useAI: boolean;
  timeLimit: number; // minutes, 0 = no limit
}

const TestMode = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(string | boolean)[]>([]);
  const [isTestStarted, setIsTestStarted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [settings, setSettings] = useState<TestSettings>({
    questionCount: 10,
    questionType: "mixed",
    useAI: true,
    timeLimit: 0,
  });

  useEffect(() => {
    fetchSetAndCards();
  }, [id]);

  useEffect(() => {
    if (isTestStarted && settings.timeLimit > 0 && timeRemaining !== null) {
      if (timeRemaining <= 0) {
        handleFinishTest();
        return;
      }
      const timer = setInterval(() => {
        setTimeRemaining((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isTestStarted, timeRemaining, settings.timeLimit]);

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

  const generateAIQuestions = async () => {
    setIsGenerating(true);
    try {
      const types = settings.questionType === "mixed" 
        ? ["multiple_choice", "true_false", "fill_blank"]
        : [settings.questionType];

      const questionsPerType = Math.ceil(settings.questionCount / types.length);
      const allQuestions: Question[] = [];

      for (const type of types) {
        const { data, error } = await supabase.functions.invoke("generate-questions", {
          body: {
            flashcards: flashcards.slice(0, 20),
            count: questionsPerType,
            questionType: type,
          },
        });

        if (error) {
          if (error.message?.includes("429")) {
            toast.error("Rate limit exceeded. Please try again in a moment.");
          } else if (error.message?.includes("402")) {
            toast.error("Please add credits to your Lovable workspace.");
          } else {
            throw error;
          }
          return;
        }

        if (data?.questions) {
          allQuestions.push(...data.questions.map((q: any) => ({ ...q, type })));
        }
      }

      const finalQuestions = allQuestions.slice(0, settings.questionCount);
      setQuestions(finalQuestions);
      setUserAnswers(new Array(finalQuestions.length).fill(""));
    } catch (error) {
      console.error("Failed to generate questions:", error);
      toast.error("Failed to generate AI questions. Using manual questions.");
      generateManualQuestions();
    } finally {
      setIsGenerating(false);
    }
  };

  const generateManualQuestions = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    const selectedCards = shuffled.slice(0, Math.min(settings.questionCount, flashcards.length));

    const types = settings.questionType === "mixed"
      ? ["multiple_choice", "true_false", "fill_blank"]
      : [settings.questionType];

    const generatedQuestions: Question[] = selectedCards.map((card, index) => {
      const type = types[index % types.length];

      if (type === "multiple_choice") {
        const otherCards = flashcards
          .filter(c => c.id !== card.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        
        const options = [
          card.definition,
          ...otherCards.map(c => c.definition)
        ].sort(() => Math.random() - 0.5);

        return {
          question: `What is the definition of "${card.term}"?`,
          options: options.map((opt, i) => `${String.fromCharCode(65 + i)}: ${opt}`),
          correctAnswer: String.fromCharCode(65 + options.indexOf(card.definition)),
          explanation: card.definition,
          type: "multiple_choice",
        };
      } else if (type === "true_false") {
        const isTrue = Math.random() > 0.5;
        const statement = isTrue 
          ? `${card.term} means ${card.definition}`
          : `${card.term} means ${flashcards.find(c => c.id !== card.id)?.definition || "something else"}`;
        
        return {
          question: statement,
          correctAnswer: isTrue,
          explanation: `${card.term} actually means: ${card.definition}`,
          type: "true_false",
        };
      } else {
        return {
          question: `Define: ${card.term}`,
          correctAnswer: card.definition,
          explanation: card.definition,
          type: "fill_blank",
        };
      }
    });

    setQuestions(generatedQuestions);
    setUserAnswers(new Array(generatedQuestions.length).fill(""));
  };

  const handleStartTest = async () => {
    if (settings.useAI) {
      await generateAIQuestions();
    } else {
      generateManualQuestions();
    }
    
    if (settings.timeLimit > 0) {
      setTimeRemaining(settings.timeLimit * 60);
    }
    
    setIsTestStarted(true);
  };

  const handleAnswerChange = (answer: string | boolean) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = answer;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleFinishTest = () => {
    setShowResults(true);
  };

  const calculateResults = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      const userAns = userAnswers[i];
      if (q.type === "fill_blank") {
        if (typeof userAns === "string" && 
            userAns.toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim()) {
          correct++;
        }
      } else {
        if (userAns === q.correctAnswer) {
          correct++;
        }
      }
    });
    return { correct, total: questions.length, percentage: (correct / questions.length) * 100 };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isTestStarted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <Card className="p-8 space-y-6">
            <div className="text-center">
              <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-2">Test Mode</h1>
              <p className="text-muted-foreground">{setTitle}</p>
            </div>

            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label>Number of Questions: {settings.questionCount}</Label>
                <Slider
                  value={[settings.questionCount]}
                  onValueChange={([value]) => 
                    setSettings({ ...settings, questionCount: value })
                  }
                  min={5}
                  max={Math.min(50, flashcards.length * 3)}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <Label>Question Type</Label>
                <RadioGroup
                  value={settings.questionType}
                  onValueChange={(value: any) => 
                    setSettings({ ...settings, questionType: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mixed" id="mixed" />
                    <Label htmlFor="mixed" className="cursor-pointer">Mixed (All Types)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="multiple_choice" id="mc" />
                    <Label htmlFor="mc" className="cursor-pointer">Multiple Choice</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="true_false" id="tf" />
                    <Label htmlFor="tf" className="cursor-pointer">True/False</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fill_blank" id="fb" />
                    <Label htmlFor="fb" className="cursor-pointer">Fill in the Blank</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <Label htmlFor="use-ai" className="cursor-pointer">
                    AI-Generated Questions
                  </Label>
                </div>
                <Switch
                  id="use-ai"
                  checked={settings.useAI}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, useAI: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Time Limit: {settings.timeLimit === 0 ? "None" : `${settings.timeLimit} min`}</Label>
                <Slider
                  value={[settings.timeLimit]}
                  onValueChange={([value]) => 
                    setSettings({ ...settings, timeLimit: value })
                  }
                  min={0}
                  max={60}
                  step={5}
                />
              </div>
            </div>

            <Button
              onClick={handleStartTest}
              className="w-full"
              size="lg"
              disabled={isGenerating}
            >
              {isGenerating ? "Generating Questions..." : "Start Test"}
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (showResults) {
    const results = calculateResults();
    
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 max-w-3xl">
          <Card className="p-8 space-y-6 text-center">
            <Trophy className="w-20 h-20 text-primary mx-auto" />
            <h1 className="text-4xl font-bold">Test Complete!</h1>
            
            <div className="grid grid-cols-3 gap-4 py-6">
              <div className="space-y-2">
                <div className="text-4xl font-bold text-success">{results.correct}</div>
                <div className="text-sm text-muted-foreground">Correct</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl font-bold text-destructive">
                  {results.total - results.correct}
                </div>
                <div className="text-sm text-muted-foreground">Incorrect</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl font-bold text-primary">
                  {results.percentage.toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">Score</div>
              </div>
            </div>

            <Progress value={results.percentage} className="h-3" />

            <div className="pt-4 space-y-4">
              {questions.map((q, i) => {
                const userAns = userAnswers[i];
                const isCorrect = q.type === "fill_blank"
                  ? String(userAns).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim()
                  : userAns === q.correctAnswer;

                return (
                  <Card key={i} className={cn(
                    "p-4 text-left",
                    isCorrect ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5"
                  )}>
                    <div className="font-semibold mb-2">
                      {i + 1}. {q.question}
                    </div>
                    {q.options && (
                      <div className="text-sm space-y-1 mb-2">
                        {q.options.map((opt, j) => (
                          <div key={j} className={cn(
                            opt.startsWith(String(q.correctAnswer)) && "font-semibold text-success",
                            opt.startsWith(String(userAns)) && !isCorrect && "font-semibold text-destructive"
                          )}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="font-semibold">Your answer: </span>
                      <span className={isCorrect ? "text-success" : "text-destructive"}>
                        {String(userAns || "Not answered")}
                      </span>
                    </div>
                    {!isCorrect && (
                      <div className="text-sm mt-2 text-muted-foreground">
                        <span className="font-semibold">Correct: </span>
                        {String(q.correctAnswer)}
                      </div>
                    )}
                    <div className="text-sm mt-2 text-muted-foreground italic">
                      {q.explanation}
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={() => {
                setIsTestStarted(false);
                setShowResults(false);
                setCurrentIndex(0);
                setUserAnswers([]);
                setQuestions([]);
              }} variant="outline" className="flex-1">
                Take Another Test
              </Button>
              <Button onClick={() => navigate("/")} className="flex-1">
                Back to Dashboard
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => {
              if (confirm("Are you sure you want to exit? Your progress will be lost.")) {
                navigate("/");
              }
            }}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <div className="text-center">
              <h1 className="font-semibold">{setTitle} - Test</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  Question {currentIndex + 1}/{questions.length}
                </span>
                {timeRemaining !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
            <div className="w-20"></div>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Card className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-2xl font-bold">{currentQuestion.question}</div>
          </div>

          <div className="space-y-4">
            {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
              <RadioGroup
                value={String(userAnswers[currentIndex] || "")}
                onValueChange={handleAnswerChange}
              >
                <div className="space-y-3">
                  {currentQuestion.options.map((option, i) => (
                    <div key={i} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer">
                      <RadioGroupItem value={option[0]} id={`opt-${i}`} />
                      <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}

            {currentQuestion.type === "true_false" && (
              <RadioGroup
                value={String(userAnswers[currentIndex] || "")}
                onValueChange={(value) => handleAnswerChange(value === "true")}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3 p-6 border rounded-lg hover:bg-accent/50 cursor-pointer">
                    <RadioGroupItem value="true" id="true" />
                    <Label htmlFor="true" className="flex-1 cursor-pointer text-lg font-semibold">
                      True
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-6 border rounded-lg hover:bg-accent/50 cursor-pointer">
                    <RadioGroupItem value="false" id="false" />
                    <Label htmlFor="false" className="flex-1 cursor-pointer text-lg font-semibold">
                      False
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            )}

            {currentQuestion.type === "fill_blank" && (
              <Input
                value={String(userAnswers[currentIndex] || "")}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Type your answer..."
                className="text-lg p-6"
              />
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handlePrevious}
              variant="outline"
              disabled={currentIndex === 0}
            >
              Previous
            </Button>
            <div className="flex-1"></div>
            {currentIndex < questions.length - 1 ? (
              <Button onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button onClick={handleFinishTest} className="bg-success hover:bg-success/90">
                Finish Test
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default TestMode;
