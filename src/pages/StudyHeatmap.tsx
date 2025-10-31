import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar } from "lucide-react";
import { toast } from "sonner";

interface HeatmapData {
  date: string;
  count: number;
}

const StudyHeatmap = () => {
  const navigate = useNavigate();
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  const fetchHeatmapData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get study progress from last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data } = await supabase
        .from("study_progress")
        .select("last_studied_at, times_reviewed")
        .eq("user_id", user.id)
        .gte("last_studied_at", ninetyDaysAgo.toISOString());

      if (data) {
        // Group by date and count reviews
        const grouped = data.reduce((acc: { [key: string]: number }, curr) => {
          if (curr.last_studied_at) {
            const date = new Date(curr.last_studied_at).toISOString().split("T")[0];
            acc[date] = (acc[date] || 0) + (curr.times_reviewed || 1);
          }
          return acc;
        }, {});

        const heatmap = Object.entries(grouped).map(([date, count]) => ({
          date,
          count: count as number,
        }));

        setHeatmapData(heatmap);
      }
    } catch (error) {
      toast.error("Failed to load heatmap data");
    } finally {
      setIsLoading(false);
    }
  };

  const getLast90Days = () => {
    const days = [];
    for (let i = 89; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split("T")[0]);
    }
    return days;
  };

  const getIntensity = (count: number) => {
    if (count === 0) return "bg-muted";
    if (count <= 2) return "bg-primary/20";
    if (count <= 5) return "bg-primary/40";
    if (count <= 10) return "bg-primary/60";
    return "bg-primary";
  };

  const days = getLast90Days();
  const dataMap = new Map(heatmapData.map(d => [d.date, d.count]));

  // Group by weeks
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

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

      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Calendar className="w-8 h-8" />
            Study Heatmap
          </h1>
          <p className="text-muted-foreground">Visualize your study patterns over time</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Last 90 Days Activity</CardTitle>
            <CardDescription>Each square represents one day. Darker colors indicate more study sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-flex flex-col gap-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex gap-1">
                    {week.map((day) => {
                      const count = dataMap.get(day) || 0;
                      return (
                        <div
                          key={day}
                          className={`w-4 h-4 rounded-sm ${getIntensity(count)} transition-colors hover:ring-2 hover:ring-primary cursor-pointer`}
                          title={`${day}: ${count} reviews`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-sm bg-muted" />
                <div className="w-4 h-4 rounded-sm bg-primary/20" />
                <div className="w-4 h-4 rounded-sm bg-primary/40" />
                <div className="w-4 h-4 rounded-sm bg-primary/60" />
                <div className="w-4 h-4 rounded-sm bg-primary" />
              </div>
              <span>More</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Study Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="font-medium">Total Study Days</span>
              <span className="text-2xl font-bold">{heatmapData.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="font-medium">Total Reviews</span>
              <span className="text-2xl font-bold">
                {heatmapData.reduce((sum, d) => sum + d.count, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="font-medium">Current Streak</span>
              <span className="text-2xl font-bold">
                {calculateStreak(days, dataMap)} days
              </span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

const calculateStreak = (days: string[], dataMap: Map<string, number>) => {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (dataMap.get(days[i])) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

export default StudyHeatmap;
