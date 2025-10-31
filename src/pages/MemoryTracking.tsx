import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Brain, TrendingUp, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface StudyStats {
  total_cards: number;
  mastered: number;
  learning: number;
  needs_review: number;
}

const MemoryTracking = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StudyStats>({
    total_cards: 0,
    mastered: 0,
    learning: 0,
    needs_review: 0,
  });
  const [reviewAlerts, setReviewAlerts] = useState<Array<{ set_title: string; card_count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get all study progress
      const { data: progressData } = await supabase
        .from("study_progress")
        .select("*, flashcards(set_id, flashcard_sets(title))")
        .eq("user_id", user.id);

      if (progressData) {
        const total = progressData.length;
        const mastered = progressData.filter(p => p.mastery_level >= 4).length;
        const learning = progressData.filter(p => p.mastery_level > 0 && p.mastery_level < 4).length;
        
        // Cards that haven't been studied in 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const needsReview = progressData.filter(p => 
          p.last_studied_at && new Date(p.last_studied_at) < sevenDaysAgo
        ).length;

        setStats({
          total_cards: total,
          mastered,
          learning,
          needs_review: needsReview,
        });

        // Group by set for review alerts
        const reviewBySet = progressData
          .filter(p => p.last_studied_at && new Date(p.last_studied_at) < sevenDaysAgo)
          .reduce((acc: any, curr: any) => {
            const setTitle = curr.flashcards?.flashcard_sets?.title || "Unknown Set";
            if (!acc[setTitle]) {
              acc[setTitle] = 0;
            }
            acc[setTitle]++;
            return acc;
          }, {});

        const alerts = Object.entries(reviewBySet).map(([title, count]) => ({
          set_title: title,
          card_count: count as number,
        }));

        setReviewAlerts(alerts);
      }
    } catch (error) {
      toast.error("Failed to load memory tracking data");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const retentionRate = stats.total_cards > 0 
    ? ((stats.mastered / stats.total_cards) * 100).toFixed(1) 
    : 0;

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

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Brain className="w-8 h-8" />
            Memory Tracking
          </h1>
          <p className="text-muted-foreground">Track your learning progress and retention</p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Cards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_cards}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mastered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.mastered}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Learning</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-learning-foreground">{stats.learning}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Needs Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.needs_review}</div>
            </CardContent>
          </Card>
        </div>

        {/* Retention Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Overall Retention Rate
            </CardTitle>
            <CardDescription>Percentage of cards you've mastered</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-5xl font-bold">{retentionRate}%</div>
            <Progress value={Number(retentionRate)} className="h-3" />
            <p className="text-sm text-muted-foreground">
              Keep studying to improve your retention rate!
            </p>
          </CardContent>
        </Card>

        {/* Review Alerts */}
        {reviewAlerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                Review Reminders
              </CardTitle>
              <CardDescription>These cards need your attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reviewAlerts.map((alert, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <div>
                      <div className="font-medium">{alert.set_title}</div>
                      <div className="text-sm text-muted-foreground">
                        {alert.card_count} {alert.card_count === 1 ? "card" : "cards"} not reviewed in 7+ days
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Review Now
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {stats.total_cards === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Start studying flashcards to see your memory tracking data!
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default MemoryTracking;
