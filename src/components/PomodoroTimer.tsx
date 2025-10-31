import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const PomodoroTimer = () => {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && (minutes > 0 || seconds > 0)) {
      interval = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            setIsActive(false);
            toast.success(mode === "work" ? "Work session complete! Take a break." : "Break complete! Ready to work?");
            // Auto-switch mode
            if (mode === "work") {
              setMode("break");
              setMinutes(5);
            } else {
              setMode("work");
              setMinutes(25);
            }
          } else {
            setMinutes(minutes - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(seconds - 1);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, minutes, seconds, mode]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    if (mode === "work") {
      setMinutes(25);
      setSeconds(0);
    } else {
      setMinutes(5);
      setSeconds(0);
    }
  };

  const switchMode = () => {
    setIsActive(false);
    if (mode === "work") {
      setMode("break");
      setMinutes(5);
      setSeconds(0);
    } else {
      setMode("work");
      setMinutes(25);
      setSeconds(0);
    }
  };

  const totalSeconds = mode === "work" ? 25 * 60 : 5 * 60;
  const currentSeconds = minutes * 60 + seconds;
  const progress = ((totalSeconds - currentSeconds) / totalSeconds) * 100;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="w-5 h-5" />
          Pomodoro Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-2">
            {mode === "work" ? "Work Session" : "Break Time"}
          </div>
          <div className="text-6xl font-bold tabular-nums">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
        </div>
        
        <Progress value={progress} className="h-2" />
        
        <div className="flex gap-2">
          <Button onClick={toggleTimer} className="flex-1">
            {isActive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isActive ? "Pause" : "Start"}
          </Button>
          <Button onClick={resetTimer} variant="outline" size="icon">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button onClick={switchMode} variant="outline" className="flex-1">
            Switch to {mode === "work" ? "Break" : "Work"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PomodoroTimer;
