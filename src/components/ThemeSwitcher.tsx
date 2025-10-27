import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const ThemeSwitcher = () => {
  const [isNeonTheme, setIsNeonTheme] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "neon") {
      setIsNeonTheme(true);
      document.documentElement.setAttribute("data-theme", "neon");
    }
  }, []);

  const toggleTheme = (checked: boolean) => {
    setIsNeonTheme(checked);
    if (checked) {
      document.documentElement.setAttribute("data-theme", "neon");
      localStorage.setItem("theme", "neon");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "default");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="theme-switch" className="text-sm cursor-pointer">
        {isNeonTheme ? "🌟 Neon" : "💜 Classic"}
      </Label>
      <Switch
        id="theme-switch"
        checked={isNeonTheme}
        onCheckedChange={toggleTheme}
      />
    </div>
  );
};

export default ThemeSwitcher;
