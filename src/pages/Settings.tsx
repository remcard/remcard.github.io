import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

const themes = [
  { id: "normal", name: "Normal", description: "White and light purple" },
  { id: "midnight", name: "Midnight", description: "Dark grey with light blue" },
  { id: "magical", name: "Magical", description: "Dark purple theme" },
  { id: "sepia", name: "Sepia", description: "Warm sepia tones" },
  { id: "sage", name: "Sage", description: "Cream and light sage" },
];

const musicTracks = [
  { id: "lofi", name: "Lofi", url: "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3" },
  { id: "rock", name: "Rock", url: "https://assets.mixkit.co/music/preview/mixkit-rock-guitar-loop-3.mp3" },
];

const Settings = () => {
  const navigate = useNavigate();
  const [currentTheme, setCurrentTheme] = useState("normal");
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState("lofi");
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load saved preferences
    const savedTheme = localStorage.getItem("theme") || "normal";
    const savedMusicEnabled = localStorage.getItem("musicEnabled") === "true";
    const savedMusicType = localStorage.getItem("musicType") || "lofi";

    setCurrentTheme(savedTheme);
    setMusicEnabled(savedMusicEnabled);
    setSelectedMusic(savedMusicType);

    // Apply theme
    applyTheme(savedTheme);

    // Initialize audio
    if (savedMusicEnabled) {
      playMusic(savedMusicType);
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    };
  }, []);

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.removeAttribute("data-theme");

    if (theme === "midnight") {
      root.classList.add("dark");
    } else if (theme !== "normal") {
      root.setAttribute("data-theme", theme);
    }
  };

  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme);
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    toast.success("Theme updated!");
  };

  const playMusic = (musicType: string) => {
    const track = musicTracks.find(t => t.id === musicType);
    if (!track) return;

    if (audio) {
      audio.pause();
    }

    const newAudio = new Audio(track.url);
    newAudio.loop = true;
    newAudio.volume = 0.3;
    newAudio.play().catch(err => {
      console.error("Error playing audio:", err);
      toast.error("Failed to play music");
    });
    setAudio(newAudio);
  };

  const handleMusicToggle = (enabled: boolean) => {
    setMusicEnabled(enabled);
    localStorage.setItem("musicEnabled", enabled.toString());

    if (enabled) {
      playMusic(selectedMusic);
      toast.success("Music enabled!");
    } else {
      if (audio) {
        audio.pause();
      }
      toast.success("Music disabled");
    }
  };

  const handleMusicTypeChange = (musicType: string) => {
    setSelectedMusic(musicType);
    localStorage.setItem("musicType", musicType);

    if (musicEnabled) {
      playMusic(musicType);
      toast.success(`Switched to ${musicType === "lofi" ? "Lofi" : "Rock"} music`);
    }
  };

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

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Customize your study experience</p>
        </div>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Choose your preferred color theme</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={currentTheme} onValueChange={handleThemeChange}>
              <div className="space-y-3">
                {themes.map((theme) => (
                  <div key={theme.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                    <RadioGroupItem value={theme.id} id={theme.id} />
                    <Label htmlFor={theme.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{theme.name}</div>
                      <div className="text-sm text-muted-foreground">{theme.description}</div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Sound Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Background Music</CardTitle>
            <CardDescription>Add ambient music to your study sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {musicEnabled ? (
                  <Volume2 className="w-5 h-5 text-primary" />
                ) : (
                  <VolumeX className="w-5 h-5 text-muted-foreground" />
                )}
                <Label htmlFor="music-toggle" className="cursor-pointer">
                  Enable Music
                </Label>
              </div>
              <Switch
                id="music-toggle"
                checked={musicEnabled}
                onCheckedChange={handleMusicToggle}
              />
            </div>

            {musicEnabled && (
              <div>
                <Label className="mb-3 block">Music Type</Label>
                <RadioGroup value={selectedMusic} onValueChange={handleMusicTypeChange}>
                  <div className="space-y-2">
                    {musicTracks.map((track) => (
                      <div key={track.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                        <RadioGroupItem value={track.id} id={`music-${track.id}`} />
                        <Label htmlFor={`music-${track.id}`} className="flex-1 cursor-pointer font-medium">
                          {track.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
