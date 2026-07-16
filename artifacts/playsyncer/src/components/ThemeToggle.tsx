import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label="تغییر تم"
      title={isDark ? "حالت روشن" : "حالت تاریک"}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-all hover:border-primary/60 hover:shadow-glow",
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-primary-glow" />
      ) : (
        <Moon className="h-4 w-4 text-primary" />
      )}
    </button>
  );
}
